#include "AstronautCharacter.h"
#include "OutpostWorld.h"
#include "OutpostCommon.h"
#include "OutpostGameMode.h"
#include "RoverPawn.h"
#include "CrewNPC.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "EngineUtils.h"

using namespace Outpost;

AAstronautCharacter::AAstronautCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(34.f, 90.f);
	bUseControllerRotationYaw = true;

	BodyRoot = CreateDefaultSubobject<USceneComponent>(TEXT("BodyRoot"));
	BodyRoot->SetupAttachment(RootComponent);
	BodyRoot->SetRelativeLocationAndRotation(FVector(0, 0, -90), FRotator(0, -90, 0)); // model faces +Y, the actor faces +X

	EyeCam = CreateDefaultSubobject<UCameraComponent>(TEXT("EyeCam"));
	EyeCam->SetupAttachment(RootComponent);
	EyeCam->SetRelativeLocation(FVector(10, 0, 68)); // eyes about 1.6 m above the floor
	EyeCam->bUsePawnControlRotation = true;
	EyeCam->SetFieldOfView(78.f);

	Arm = CreateDefaultSubobject<USpringArmComponent>(TEXT("Arm"));
	Arm->SetupAttachment(RootComponent);
	Arm->TargetArmLength = 380.f;
	Arm->SocketOffset = FVector(0, 0, 60);
	Arm->bUsePawnControlRotation = true;
	Arm->ProbeSize = 14.f;
	TpCam = CreateDefaultSubobject<UCameraComponent>(TEXT("TpCam"));
	TpCam->SetupAttachment(Arm);
	TpCam->SetAutoActivate(false);

	UCharacterMovementComponent* M = GetCharacterMovement();
	M->MaxStepHeight = 55.f;            // greenhouse sill is 42 cm
	M->SetWalkableFloorAngle(50.f);
	M->AirControl = 0.6f;
	M->BrakingDecelerationWalking = 1600.f;
}

void AAstronautCharacter::BeginPlay()
{
	Super::BeginPlay();
	Parts = AddModel(this, BodyRoot, TEXT("astronaut"), false);
	SetFirstPerson(true);
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->SetInputMode(FInputModeGameOnly());
		PC->bShowMouseCursor = false;
		PC->SetControlRotation(GetActorRotation());
	}
}

void AAstronautCharacter::PossessedBy(AController* NewController)
{
	Super::PossessedBy(NewController);
	PossessedAt = GetWorld()->GetTimeSeconds(); // ignore the E that just got us out of the rover
}

AOutpostWorld* AAstronautCharacter::World() const
{
	for (TActorIterator<AOutpostWorld> It(GetWorld()); It; ++It) return *It;
	return nullptr;
}

void AAstronautCharacter::SetFirstPerson(bool bFp)
{
	bFirstPerson = bFp;
	EyeCam->SetActive(bFp);
	TpCam->SetActive(!bFp);
	BodyRoot->SetVisibility(!bFp, true);
}

void AAstronautCharacter::FindTarget()
{
	Target = EUseTarget::None; TargetId.Reset(); TargetNpc = -1; PromptText.Reset();
	AOutpostWorld* W = World();
	if (!W) return;
	const FVector P = GetActorLocation();
	double Best = 1e9;
	if (!bIndoor && W->Rover)
	{
		const double D = FVector::Dist2D(W->Rover->GetActorLocation(), P) / 100.0;
		if (D < 3.4) { Best = D; Target = EUseTarget::Rover; }
	}
	for (int32 K = 0; K < W->Crew.Num(); ++K)
	{
		if (!W->Crew[K]) continue;
		const double D = FVector::Dist2D(W->Crew[K]->GetActorLocation(), P) / 100.0;
		if (D < 2.0 && D < Best) { Best = D; Target = EUseTarget::Npc; TargetNpc = K; }
	}
	double Ds = 0;
	if (const FStation* S = W->NearestStation(P, bIndoor, Ds))
		if (Ds < Best) { Best = Ds; Target = EUseTarget::Station; TargetId = S->Id; }

	switch (Target)
	{
	case EUseTarget::Rover: PromptText = Tr(TEXT("E — сесть в луноход"), TEXT("E — get in the rover")); break;
	case EUseTarget::Npc: PromptText = FString::Printf(TEXT("E — %s: %s"), *Tr(TEXT("поговорить"), TEXT("talk")), *W->Crew[TargetNpc]->DisplayName()); break;
	case EUseTarget::Station:
		if (AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>()) PromptText = TEXT("E — ") + GM->StationTitle(TargetId);
		break;
	default: break;
	}
}

void AAstronautCharacter::Use()
{
	AOutpostWorld* W = World();
	AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>();
	if (!W || !GM) return;
	switch (Target)
	{
	case EUseTarget::Rover: W->Rover->Enter(this); break;
	case EUseTarget::Npc: GM->Toast(W->Crew[TargetNpc]->DisplayName() + TEXT(": ") + W->Crew[TargetNpc]->Talk()); break;
	case EUseTarget::Station: GM->OpenStation(TargetId); break;
	default: break;
	}
}

void AAstronautCharacter::Tick(float Dt)
{
	Super::Tick(Dt);
	APlayerController* PC = Cast<APlayerController>(GetController());
	AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>();
	AOutpostWorld* W = World();
	const bool bMars = W && W->bMars;

	// inside the pressurised modules: Earth-like gravity (simplification); outside: real Moon or Mars gravity
	bIndoor = AOutpostWorld::InsideBase(GetActorLocation());
	UCharacterMovementComponent* M = GetCharacterMovement();
	const double G = bIndoor ? 9.81 : (bMars ? 3.71 : 1.62);
	M->GravityScale = (float)(G / 9.81);
	M->JumpZVelocity = bIndoor ? 300.f : 220.f;
	if (!PC) return;

	const bool bPanel = GM && GM->IsPanelOpen();
	const bool bRun = PC->IsInputKeyDown(EKeys::LeftShift) || PC->IsInputKeyDown(EKeys::RightShift);
	M->MaxWalkSpeed = bIndoor ? (bRun ? 750.f : 450.f) : (bRun ? 1100.f : 650.f);

	if (!bPanel)
	{
		auto Down = [&](const FKey& K) { return PC->IsInputKeyDown(K) ? 1.f : 0.f; };
		const float Fwd = Down(EKeys::W) + Down(EKeys::Up) - Down(EKeys::S) - Down(EKeys::Down);
		const float Side = Down(EKeys::D) + Down(EKeys::Right) - Down(EKeys::A) - Down(EKeys::Left);
		const FRotator YawRot(0, PC->GetControlRotation().Yaw, 0);
		AddMovementInput(FRotationMatrix(YawRot).GetUnitAxis(EAxis::X), Fwd);
		AddMovementInput(FRotationMatrix(YawRot).GetUnitAxis(EAxis::Y), Side);

		float Mx = 0, My = 0; PC->GetInputMouseDelta(Mx, My);
		AddControllerYawInput(Mx);
		AddControllerPitchInput(-My);

		if (PC->WasInputKeyJustPressed(EKeys::SpaceBar))
		{
			Jump();
			if (bIndoor && !bJumpTold && GM)
			{
				bJumpTold = true;
				GM->Toast(Tr(TEXT("Внутри базы прыжок как на Земле. Это упрощение игры: на настоящей базе сила тяжести везде одинаковая."),
					TEXT("Inside the base you jump like on Earth. This is a game simplification: in a real base gravity is the same everywhere.")));
			}
		}
		else if (!PC->IsInputKeyDown(EKeys::SpaceBar)) StopJumping();

		if (PC->WasInputKeyJustPressed(EKeys::V)) SetFirstPerson(!bFirstPerson);
		FindTarget();
		if (PC->WasInputKeyJustPressed(EKeys::E) && GetWorld()->GetTimeSeconds() - PossessedAt > 0.3 && (!GM || GM->PanelSettled())) Use();
	}
	else PromptText.Reset();

	// walk animation for the third-person body
	const double Speed = GetVelocity().Size2D() / 100.0;
	if (!bFirstPerson)
	{
		Phase += Dt * (2.0 + Speed * 2.2);
		AnimatePerson(Parts, Phase, FMath::Min(0.6, Speed * 0.18), false);
	}
	if (GM) GM->PlayerTick(Dt, bIndoor);
}
