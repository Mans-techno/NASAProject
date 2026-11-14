// Game mode: start-up, spawning the outpost and the astronaut, keys that work everywhere, messages.
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
		S.FlareDays.Add(Days[I]); S.FlareIndex.Add(FMath::RandRange(0, OutpostRules::NumFlares() - 1));
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

