// Game rules: builds the outpost, spawns the astronaut, runs the 20-day mission.
// The day model uses the same NASA anchors as the web game (BVAD consumption, ISS water recovery,
// regolith shielding, real archived solar proton storms), in a simplified form.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "OutpostGameMode.generated.h"

class AOutpostWorld;

struct FOutpostState
{
	int32 Day = 1, Days = 20;
	double Battery = 60, BatCap = 100, O2 = 30, Water = 120, Food = 80, Health = 100, Dose = 0;
	int32 Parts = 8, Panels = 5, Greenhouses = 2, Shield = 1, Science = 0, Data = 0, Batteries = 0;
	double Dust = 0;
	bool bReactor = false, bLeak = false;
	double SuitO2 = 100;
	FString Action = TEXT("rest");
	TArray<int32> FlareDays;   // days with a proton storm
	TArray<int32> FlareIndex;  // which real event (row of FlareData.inl)
	FString Over;              // "", "win", "health", "o2", "dose"
};

struct FToast { FString Text; double Until = 0; };

UCLASS()
class LUNAROUTPOST_API AOutpostGameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	AOutpostGameMode();
	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;
	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	// called by the player pawn every frame
	void PlayerTick(float Dt, bool bIndoor);
	void Toast(const FString& Text, double Seconds = 7.0);
	FString StationTitle(const FString& Id) const;
	void OpenStation(const FString& Id);
	bool IsPanelOpen() const { return !PanelId.IsEmpty(); }
	// E both opens and closes panels: ignore it for a moment after a change so one press does one thing
	bool PanelSettled() const { return Clock - PanelChangedAt > 0.25; }

	// read by the HUD
	FOutpostState S;
	bool bMars = false;
	FString PanelId;
	TArray<FString> PanelLines;
	TArray<FToast> Toasts;
	FString ActionName(const FString& Id) const;
	bool StormToday() const;
	const TCHAR* PlanetName() const;

private:
	UPROPERTY() TObjectPtr<AOutpostWorld> OutpostWorld = nullptr;
	UPROPERTY() TObjectPtr<AActor> Start = nullptr;
	TArray<FString> PanelActions;
	double Clock = 0, PanelChangedAt = -1;
	void ClosePanel() { PanelId.Reset(); PanelChangedAt = Clock; }

	void BuildPanel();
	void ChooseAction(const FString& Id);
	void SendData();
	void EndDay();
	FString StationFact(const FString& Id) const;
	int32 ActionParts(const FString& Id) const;
};
