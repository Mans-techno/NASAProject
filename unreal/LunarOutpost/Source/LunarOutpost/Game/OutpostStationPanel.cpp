// Station panels: names, facts, the task choices and what each task costs.
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

namespace
{
	struct FFact { const TCHAR* Id; const TCHAR* Ru; const TCHAR* En; };
	const FFact GFacts[] = {
#include "StationFacts.inl"
	};
}

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

