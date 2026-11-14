// One mission day: the crew task, power, oxygen, water, food, radiation and real solar storms; suit air outside.
#include "OutpostGameMode.h"
#include "OutpostWorld.h"
#include "OutpostCommon.h"
#include "OutpostHUD.h"
#include "AstronautCharacter.h"
#include "GameFramework/PlayerStart.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "OutpostRules.h"

using namespace Outpost;

using namespace OutpostRules;

namespace OutpostRules
{
	// real archived solar flares and proton storms (NOAA SWPC / NASA DONKI)
	static const FFlare GFlares[] = {
#include "FlareData.inl"
	};
	int32 NumFlares() { return UE_ARRAY_COUNT(GFlares); }
	const FFlare& Flare(int32 I) { return GFlares[FMath::Clamp(I, 0, NumFlares() - 1)]; }
}

void AOutpostGameMode::SendData()
{
	const double Kwh = bMars ? 10 : 4;
	if (S.Data <= 0) { Toast(Tr(TEXT("Пока нечего передавать: сначала возьми пробы в лаборатории или на буровой."), TEXT("Nothing to send yet: take samples at the lab or the drill first."))); return; }
	if (S.Battery < Kwh) { Toast(Tr(TEXT("Не хватает энергии для передачи."), TEXT("Not enough power to transmit."))); return; }
	S.Battery -= Kwh; S.Science += S.Data;
	Toast(FString::Printf(TEXT("%s +%d. %s %d/%d"), *Tr(TEXT("Данные дошли до Земли! Наука"), TEXT("Data reached Earth! Science")), S.Data,
		*Tr(TEXT("Всего"), TEXT("Total")), S.Science, SCIENCE_GOAL));
	S.Data = 0;
	ClosePanel();
}

void AOutpostGameMode::EndDay()
{
	if (!S.Over.IsEmpty()) return;
	const FString A = S.Action;
	S.Parts -= ActionParts(A);
	// the crew's task
	if (A == TEXT("rest")) S.Health = FMath::Min(100.0, S.Health + 10);
	else if (A == TEXT("science")) S.Data += 1;
	else if (A == TEXT("shield")) { S.Shield = FMath::Min(4, S.Shield + 1); if (OutpostWorld) OutpostWorld->AddBermLayer(S.Shield); }
	else if (A == TEXT("panel")) S.Panels += 1;
	else if (A == TEXT("battery")) { S.Batteries += 1; S.BatCap += BAT_ADD; }
	else if (A == TEXT("greenhouse")) S.Greenhouses += 1;
	else if (A == TEXT("ice")) { S.Water += 60; S.Battery -= 10; }
	else if (A == TEXT("repair")) S.bLeak = false;
	else if (A == TEXT("clean")) S.Dust = 0;

	// power: sunlight on the panels, minus life support, heating, greenhouse and radio
	const double PanelKwh = bMars ? 14 : 16, Heat = bMars ? 14 : 16, Comm = bMars ? 10 : 4;
	const double Made = S.Panels * PanelKwh * (1 - S.Dust) + (S.bReactor ? 40 : 0);
	const double Need = O2_SYS_KWH + WATER_SYS_KWH + Heat + S.Greenhouses * GH_KWH + Comm * 0.25;
	S.Battery += Made - Need;
	bool bBlackout = false;
	if (S.Battery < 0) { bBlackout = true; S.Battery = 0; }
	S.Battery = FMath::Min(S.Battery, S.BatCap);
	if (bMars) S.Dust = FMath::Min(0.6, S.Dust + 0.025);

	// oxygen, water and food for 4 people (NASA BVAD numbers)
	const double O2Made = bBlackout ? 0 : O2_SYS_KG;
	S.O2 = FMath::Min(O2_CAP, S.O2 + O2Made + S.Greenhouses * GH_O2 - O2_PER * CREW - (S.bLeak ? 2.0 : 0));
	S.Water -= WATER_GROSS * CREW * (1 - RECOVERY) + O2Made * O2_WATER_PER_KG;
	S.Food += S.Greenhouses * GH_FOOD - FOOD_PER * CREW;
	if (bBlackout) { S.Health -= 8; Toast(Tr(TEXT("Не хватило энергии: обогрев и кислород отключались. Экипаж мёрзнет."), TEXT("Power ran out: heating and oxygen went off. The crew is cold."))); }
	if (S.Food < 0) { S.Food = 0; S.Health -= 15; Toast(Tr(TEXT("Закончилась еда! Нужна теплица."), TEXT("Out of food! Build up the greenhouse."))); }
	if (S.Water < 0) { S.Water = 0; S.Health -= 20; Toast(Tr(TEXT("Закончилась вода! Добудь лёд на буровой."), TEXT("Out of water! Mine ice at the drill."))); }

	// radiation: daily background plus real archived proton storms
	S.Dose += bMars ? 0.67 : 1.37;
	const int32 K = S.FlareDays.IndexOfByKey(S.Day);
	if (K != INDEX_NONE)
	{
		const FFlare& F = Flare(S.FlareIndex[K]);
		const double D = F.Dose * (bMars ? 0.6 : 1.0) * SHIELD[S.Shield];
		S.Dose += D;
		Toast(FString::Printf(TEXT("%s %s, %s %s. %s %.1f %s (%s %d). %s: %s"),
			*Tr(TEXT("Солнечная буря! Настоящее событие"), TEXT("Solar storm! A real event from")), F.Date, *Tr(TEXT("вспышка"), TEXT("flare")), F.Cls,
			*Tr(TEXT("Доза экипажа"), TEXT("Crew dose")), D, *Tr(TEXT("мЗв"), TEXT("mSv")), *Tr(TEXT("слоёв реголита"), TEXT("regolith layers")), S.Shield,
			F.Src, IsRu() ? F.NoteRu : F.NoteEn), 16);
	}
	if (S.FlareDays.Contains(S.Day + 1))
		Toast(Tr(TEXT("Прогноз: завтра солнечная буря. Насыпь реголит на купол, чтобы защитить экипаж!"), TEXT("Forecast: a solar storm tomorrow. Pile regolith on the dome to protect the crew!")), 12);
	if (FMath::FRand() < 0.07 && !S.bLeak) { S.bLeak = true; Toast(Tr(TEXT("Микрометеорит пробил обшивку: утекает воздух. Нужен ремонт у шлюза."), TEXT("A micrometeorite holed the hull: air is leaking. Repair it at the airlock."))); }

	S.Health = FMath::Clamp(S.Health, 0.0, 100.0);
	S.Action = TEXT("rest");
	if (S.Health <= 0) S.Over = TEXT("health");
	else if (S.O2 <= 0) S.Over = TEXT("o2");
	else if (S.Dose >= DOSE_LIMIT) S.Over = TEXT("dose");
	else if (S.Day >= S.Days) S.Over = TEXT("win");
	else
	{
		S.Day += 1;
		Toast(FString::Printf(TEXT("%s %d %s %d"), bMars ? *Tr(TEXT("Сол"), TEXT("Sol")) : *Tr(TEXT("День"), TEXT("Day")), S.Day, *Tr(TEXT("из"), TEXT("of")), S.Days), 5);
	}
}

void AOutpostGameMode::PlayerTick(float Dt, bool bIndoor)
{
	if (!S.Over.IsEmpty()) return;
	if (bIndoor) S.SuitO2 = FMath::Min(100.0, S.SuitO2 + 35 * Dt); // the suit tops up from the base supply
	else
	{
		S.SuitO2 -= Dt * 100.0 / 150.0; // about 2.5 minutes of air per trip outside
		if (StormToday()) S.Dose += Dt * 0.25 * (bMars ? 0.6 : 1.0);
		if (S.SuitO2 < 25 && S.SuitO2 + Dt * 100.0 / 150.0 >= 25)
			Toast(Tr(TEXT("Мало кислорода в скафандре! Вернись внутрь базы через шлюз."), TEXT("Suit oxygen low! Get back inside through the airlock.")));
		if (S.SuitO2 <= 0)
		{
			S.SuitO2 = 100; S.Health = FMath::Max(0.0, S.Health - 10);
			Toast(Tr(TEXT("Кислород в скафандре кончился: экипаж затащил тебя в шлюз. Здоровье −10."), TEXT("Your suit ran out of air: the crew pulled you into the airlock. Health −10.")));
			if (APawn* P = UGameplayStatics::GetPlayerPawn(this, 0)) P->SetActorLocation(U(20.0, 0, 1.4), false, nullptr, ETeleportType::TeleportPhysics);
		}
	}
}

