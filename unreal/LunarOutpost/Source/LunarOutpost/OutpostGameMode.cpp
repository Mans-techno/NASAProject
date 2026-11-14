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

using namespace Outpost;

namespace
{
	// NASA anchors, same as the web game
	const int32 CREW = 4;
	const double O2_PER = 0.84, FOOD_PER = 1.8, WATER_GROSS = 10, RECOVERY = 0.90;
	const double O2_SYS_KWH = 20, O2_SYS_KG = 3.6, O2_WATER_PER_KG = 1.125, WATER_SYS_KWH = 8;
	const double GH_KWH = 12, GH_FOOD = 1.6, GH_O2 = 0.4, O2_CAP = 60, BAT_ADD = 60;
	const double DOSE_LIMIT = 100;
	const double SHIELD[5] = { 1, 0.7, 0.45, 0.3, 0.2 };
	const int32 SCIENCE_GOAL = 6;

	struct FFlare { const TCHAR* Date; const TCHAR* Cls; int32 S; double Dose; const TCHAR* Src; const TCHAR* NoteRu; const TCHAR* NoteEn; };
	const FFlare GFlares[] = {
#include "FlareData.inl"
	};
	struct FFact { const TCHAR* Id; const TCHAR* Ru; const TCHAR* En; };
	const FFact GFacts[] = {
#include "StationFacts.inl"
	};
}

AOutpostGameMode::AOutpostGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	DefaultPawnClass = AAstronautCharacter::StaticClass();
	HUDClass = AOutpostHUD::StaticClass();
}

const TCHAR* AOutpostGameMode::PlanetName() const { return bMars ? (IsRu() ? TEXT("Марс") : TEXT("Mars")) : (IsRu() ? TEXT("Луна") : TEXT("Moon")); }

void AOutpostGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);
	bMars = UGameplayStatics::HasOption(Options, TEXT("mars"));
	if (UGameplayStatics::HasOption(Options, TEXT("en"))) SetRu(false);
	S = FOutpostState();
	if (bMars) { S.Water = 150; S.Food = 90; S.Parts = 12; S.Panels = 6; }
	// three proton storms from the real archive, on random days, never on day 1-3
	TArray<int32> Days; for (int32 D = 4; D <= 19; ++D) Days.Add(D);
	for (int32 K = 0; K < 3 && Days.Num(); ++K)
	{
		const int32 I = FMath::RandRange(0, Days.Num() - 1);
		S.FlareDays.Add(Days[I]); S.FlareIndex.Add(FMath::RandRange(0, UE_ARRAY_COUNT(GFlares) - 1));
		Days.RemoveAt(I);
	}
}

AActor* AOutpostGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
	// the map is empty, so the start point is made here: inside the habitat, by the airlock tunnel
	if (!Start)
	{
		FActorSpawnParameters SP; SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		Start = GetWorld()->SpawnActor<APlayerStart>(APlayerStart::StaticClass(), U(6.5, 0, 1.4), FRotator::ZeroRotator, SP);
	}
	return Start;
}

void AOutpostGameMode::StartPlay()
{
	FActorSpawnParameters SP; SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	OutpostWorld = GetWorld()->SpawnActorDeferred<AOutpostWorld>(AOutpostWorld::StaticClass(), FTransform::Identity);
	if (OutpostWorld)
	{
		OutpostWorld->bMars = bMars;
		OutpostWorld->FinishSpawning(FTransform::Identity);
	}
	Super::StartPlay(); // BeginPlay for everything: the outpost is built before the astronaut starts falling
	Toast(Tr(TEXT("Добро пожаловать на базу! WASD — идти, мышь — смотреть, E — действие, V — вид, L — English, F2 — Луна/Марс."),
		TEXT("Welcome to the base! WASD walk, mouse look, E use, V view, L — Русский, F2 Moon/Mars.")), 12);
	if (MissingAssets() > 0)
		Toast(Tr(TEXT("Модели не найдены. Запусти Scripts/import_models.py в редакторе (см. README)."), TEXT("Models not found. Run Scripts/import_models.py in the editor (see README).")), 30);
}

void AOutpostGameMode::Toast(const FString& Text, double Seconds)
{
	Toasts.Add({ Text, Clock + Seconds });
	if (Toasts.Num() > 4) Toasts.RemoveAt(0);
}

bool AOutpostGameMode::StormToday() const { return S.FlareDays.Contains(S.Day); }

FString AOutpostGameMode::StationFact(const FString& Id) const
{
	for (const FFact& F : GFacts) if (Id == F.Id) return IsRu() ? F.Ru : F.En;
	return FString();
}

FString AOutpostGameMode::StationTitle(const FString& Id) const
{
	if (Id == TEXT("door")) return Tr(TEXT("Шлюз"), TEXT("Airlock"));
	if (Id == TEXT("repair")) return Tr(TEXT("Склад запчастей"), TEXT("Spare parts"));
	if (Id == TEXT("bunks")) return Tr(TEXT("Каюты"), TEXT("Bunks"));
	if (Id == TEXT("comms")) return Tr(TEXT("Пост связи"), TEXT("Comms desk"));
	if (Id == TEXT("med")) return Tr(TEXT("Медотсек"), TEXT("Medical bay"));
	if (Id == TEXT("lab")) return Tr(TEXT("Лаборатория"), TEXT("Lab"));
	if (Id == TEXT("greenhouse")) return Tr(TEXT("Теплица"), TEXT("Greenhouse"));
	if (Id == TEXT("battery")) return Tr(TEXT("Аккумуляторы"), TEXT("Batteries"));
	if (Id == TEXT("panels")) return Tr(TEXT("Солнечные панели"), TEXT("Solar panels"));
	if (Id == TEXT("shield")) return Tr(TEXT("Карьер реголита"), TEXT("Regolith quarry"));
	if (Id == TEXT("drill")) return Tr(TEXT("Буровая"), TEXT("Drill site"));
	if (Id == TEXT("radio")) return Tr(TEXT("Антенна связи с Землёй"), TEXT("Earth antenna"));
	return Id;
}

FString AOutpostGameMode::ActionName(const FString& Id) const
{
	if (Id == TEXT("rest")) return Tr(TEXT("Отдых и тренировки"), TEXT("Rest and exercise"));
	if (Id == TEXT("science")) return bMars ? Tr(TEXT("Искать следы древней жизни"), TEXT("Search for signs of ancient life")) : Tr(TEXT("Взять керн льда со дна кратера"), TEXT("Drill an ice core in the crater"));
	if (Id == TEXT("shield")) return Tr(TEXT("Насыпать слой реголита"), TEXT("Pile on a layer of regolith"));
	if (Id == TEXT("panel")) return Tr(TEXT("Поставить солнечную панель"), TEXT("Install a solar panel"));
	if (Id == TEXT("battery")) return Tr(TEXT("Добавить аккумулятор"), TEXT("Add a battery"));
	if (Id == TEXT("greenhouse")) return Tr(TEXT("Построить грядку в теплице"), TEXT("Build a greenhouse bed"));
	if (Id == TEXT("ice")) return Tr(TEXT("Добыть лёд"), TEXT("Mine ice"));
	if (Id == TEXT("repair")) return Tr(TEXT("Ремонт"), TEXT("Repair"));
	if (Id == TEXT("clean")) return Tr(TEXT("Очистить панели от пыли"), TEXT("Clean dust off the panels"));
	if (Id == TEXT("send")) return Tr(TEXT("Передать данные на Землю"), TEXT("Radio the data to Earth"));
	if (Id == TEXT("sleep")) return Tr(TEXT("Лечь спать и закончить день"), TEXT("Go to sleep and end the day"));
	return Id;
}

int32 AOutpostGameMode::ActionParts(const FString& Id) const
{
	if (Id == TEXT("panel") || Id == TEXT("battery")) return 2;
	if (Id == TEXT("greenhouse")) return 3;
	if (Id == TEXT("repair")) return 1;
	return 0;
}

void AOutpostGameMode::OpenStation(const FString& Id)
{
	if (!S.Over.IsEmpty()) return;
	PanelId = Id; PanelChangedAt = Clock;
	PanelActions.Reset();
	if (Id == TEXT("door")) PanelActions = { TEXT("rest"), TEXT("repair"), TEXT("sleep") };
	else if (Id == TEXT("bunks")) PanelActions = { TEXT("rest"), TEXT("sleep") };
	else if (Id == TEXT("med")) PanelActions = { TEXT("rest") };
	else if (Id == TEXT("repair")) PanelActions = { TEXT("repair") };
	else if (Id == TEXT("lab")) PanelActions = { TEXT("science") };
	else if (Id == TEXT("greenhouse")) PanelActions = { TEXT("greenhouse") };
	else if (Id == TEXT("battery")) PanelActions = { TEXT("battery") };
	else if (Id == TEXT("panels")) { PanelActions = { TEXT("panel") }; if (bMars) PanelActions.Add(TEXT("clean")); }
	else if (Id == TEXT("shield")) PanelActions = { TEXT("shield") };
	else if (Id == TEXT("drill")) PanelActions = { TEXT("ice"), TEXT("science") };
	else if (Id == TEXT("radio") || Id == TEXT("comms")) PanelActions = { TEXT("send") };
	BuildPanel();
}

void AOutpostGameMode::BuildPanel()
{
	PanelLines.Reset();
	PanelLines.Add(StationTitle(PanelId));
	PanelLines.Add(StationFact(PanelId));
	if (PanelId == TEXT("comms") || PanelId == TEXT("radio"))
		PanelLines.Add(bMars ? Tr(TEXT("Сигнал до Земли идёт от 4 до 24 минут, поэтому база должна справляться сама."), TEXT("A signal takes 4 to 24 minutes to reach Earth, so the base must manage on its own."))
			: Tr(TEXT("Сигнал до Земли идёт около 1,3 секунды."), TEXT("A signal takes about 1.3 seconds to reach Earth.")));
	PanelLines.Add(FString::Printf(TEXT("%s: %s"), *Tr(TEXT("Задание дня"), TEXT("Today's task")), *ActionName(S.Action)));
	for (int32 I = 0; I < PanelActions.Num(); ++I)
	{
		const int32 P = ActionParts(PanelActions[I]);
		PanelLines.Add(FString::Printf(TEXT("%d — %s%s"), I + 1, *ActionName(PanelActions[I]),
			P > 0 ? *FString::Printf(TEXT(" (%s: %d)"), *Tr(TEXT("запчасти"), TEXT("parts")), P) : TEXT("")));
	}
	PanelLines.Add(Tr(TEXT("E — закрыть"), TEXT("E — close")));
}

void AOutpostGameMode::ChooseAction(const FString& Id)
{
	if (Id == TEXT("sleep")) { ClosePanel(); EndDay(); return; }
	if (Id == TEXT("send")) { SendData(); return; }
	if (Id == TEXT("shield") && S.Shield >= 4) { Toast(Tr(TEXT("Уже 4 слоя реголита."), TEXT("Already 4 layers of regolith."))); return; }
	if (Id == TEXT("repair") && !S.bLeak) { Toast(Tr(TEXT("Всё исправно."), TEXT("Nothing is broken."))); return; }
	if (ActionParts(Id) > S.Parts) { Toast(Tr(TEXT("Не хватает запчастей."), TEXT("Not enough spare parts."))); return; }
	S.Action = Id;
	Toast(FString::Printf(TEXT("%s: %s. %s"), *Tr(TEXT("Задание дня"), TEXT("Today's task")), *ActionName(Id),
		*Tr(TEXT("Экипаж выполнит его, когда ты ляжешь спать."), TEXT("The crew does it when you go to sleep."))));
	ClosePanel();
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
		const FFlare& F = GFlares[S.FlareIndex[K]];
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

void AOutpostGameMode::Tick(float Dt)
{
	Super::Tick(Dt);
	Clock += Dt;
	Toasts.RemoveAll([&](const FToast& T) { return T.Until < Clock; });
	APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (!PC) return;
	if (PC->WasInputKeyJustPressed(EKeys::L)) { SetRu(!IsRu()); if (IsPanelOpen()) BuildPanel(); }
	if (PC->WasInputKeyJustPressed(EKeys::F2))
	{
		FString Opt = bMars ? TEXT("") : TEXT("mars");
		if (!IsRu()) Opt += Opt.IsEmpty() ? TEXT("en") : TEXT("?en");
		UGameplayStatics::OpenLevel(this, FName(TEXT("/Engine/Maps/Entry")), true, Opt);
		return;
	}
	if (!S.Over.IsEmpty() && PC->WasInputKeyJustPressed(EKeys::Enter))
	{
		UGameplayStatics::OpenLevel(this, FName(TEXT("/Engine/Maps/Entry")), true, bMars ? TEXT("mars") : TEXT(""));
		return;
	}
	if (!IsPanelOpen()) return;
	static const FKey Num[9] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five, EKeys::Six, EKeys::Seven, EKeys::Eight, EKeys::Nine };
	for (int32 I = 0; I < PanelActions.Num() && I < 9; ++I)
		if (PC->WasInputKeyJustPressed(Num[I])) { ChooseAction(PanelActions[I]); return; }
	if ((PC->WasInputKeyJustPressed(EKeys::E) || PC->WasInputKeyJustPressed(EKeys::Q)) && PanelSettled()) ClosePanel();
}
