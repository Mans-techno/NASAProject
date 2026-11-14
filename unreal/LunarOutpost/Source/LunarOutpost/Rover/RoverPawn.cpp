#include "RoverPawn.h"
#include "OutpostWorld.h"
#include "OutpostCommon.h"
#include "OutpostGameMode.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"

using namespace Outpost;

ARoverPawn::ARoverPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Body = CreateDefaultSubobject<USceneComponent>(TEXT("Body"));
	Body->SetupAttachment(RootComponent);
	DriverRoot = CreateDefaultSubobject<USceneComponent>(TEXT("DriverRoot"));
	DriverRoot->SetupAttachment(Body);
	// web: driver at (-0.22, 0.17, -0.42) in the rover, turned to face forward
	DriverRoot->SetRelativeLocationAndRotation(U(-0.22, -0.42, 0.17), FRotator(0, Yaw(PI / 2), 0));

	Arm = CreateDefaultSubobject<USpringArmComponent>(TEXT("Arm"));
	Arm->SetupAttachment(RootComponent);
	Arm->TargetArmLength = 900.f;
	Arm->SocketOffset = FVector(0, 0, 250);
	Arm->SetRelativeRotation(FRotator(-12, 0, 0));
	Arm->bDoCollisionTest = false;
	Arm->bEnableCameraRotationLag = true;
	Arm->CameraRotationLagSpeed = 4.f;
	ChaseCam = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCam"));
	ChaseCam->SetupAttachment(Arm);
	SeatCam = CreateDefaultSubobject<UCameraComponent>(TEXT("SeatCam"));
	SeatCam->SetupAttachment(Body);
	SeatCam->SetRelativeLocation(FVector(-10, -42, 175));
	SeatCam->SetAutoActivate(false);
	AutoPossessPlayer = EAutoReceiveInput::Disabled;
}

void ARoverPawn::BeginPlay()
{
	Super::BeginPlay();
	Parts = AddModel(this, Body, TEXT("rover"), true);
	Driver = AddModel(this, DriverRoot, TEXT("astronaut"), false);
	// sitting pose, same angles as the web game
	auto Set = [&](const TCHAR* N, double Rad) { if (UStaticMeshComponent** C = Driver.Find(N)) (*C)->SetRelativeRotation(FRotator(0, 0, FMath::RadiansToDegrees(Rad))); };
	Set(TEXT("legL"), -1.45); Set(TEXT("legR"), -1.45); Set(TEXT("armL"), -0.75); Set(TEXT("armR"), -0.95);
	DriverRoot->SetVisibility(false, true);
	// wheels and the seated driver never block anything: the body handles collision
	for (auto& P : Parts) if (P.Key.StartsWith(TEXT("w"))) P.Value->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Heading = FMath::DegreesToRadians(GetActorRotation().Yaw);
	SetActorRotation(FRotator::ZeroRotator);
	Pose(GetActorLocation().X, GetActorLocation().Y, Heading);
}

void ARoverPawn::Pose(double XCm, double YCm, double H)
{
	const FVector F(FMath::Cos(H), FMath::Sin(H), 0), R(-FMath::Sin(H), FMath::Cos(H), 0); // forward, right
	auto G = [&](double A, double B) { const FVector P = FVector(XCm, YCm, 0) + F * A + R * B; return OutpostWorld ? OutpostWorld->GroundZ(P.X, P.Y) : 0.0; };
	const double FL = G(105, -88), FR = G(105, 88), RL = G(-105, -88), RR = G(-105, 88);
	const double Pitch = FMath::RadiansToDegrees(FMath::Atan2((FL + FR) - (RL + RR), 420.0));
	const double Roll = FMath::RadiansToDegrees(FMath::Atan2((FL + RL) - (FR + RR), 352.0));
	const double T = (FL + FR + RL + RR) / 4.0;
	SetActorLocation(FVector(XCm, YCm, bHasY ? Y * 100.0 : T));
	Body->SetWorldRotation(FRotator(Pitch, FMath::RadiansToDegrees(H), Roll));
	Arm->SetWorldRotation(FRotator(-12, FMath::RadiansToDegrees(H), 0));
}

bool ARoverPawn::Clear(double XCm, double YCm, double H) const
{
	const FVector F(FMath::Cos(H), FMath::Sin(H), 0), R(-FMath::Sin(H), FMath::Cos(H), 0);
	static const double Pts[8][2] = { {160,95},{160,-95},{-150,95},{-150,-95},{160,0},{-150,0},{0,100},{0,-100} };
	for (const auto& Pt : Pts)
		if (AOutpostWorld::InsideBase(FVector(XCm, YCm, 0) + F * Pt[0] + R * Pt[1])) return false;
	// anything solid (modules, panels, rocks) at body height, ignoring the ground and the rover itself
	FCollisionQueryParams Q(TEXT("RoverClear"), false, this);
	if (OutpostWorld && OutpostWorld->GetGround()) Q.AddIgnoredComponent(OutpostWorld->GetGround());
	if (Passenger) Q.AddIgnoredActor(Passenger);
	const double Gz = OutpostWorld ? OutpostWorld->GroundZ(XCm, YCm) : 0.0;
	return !GetWorld()->OverlapBlockingTestByChannel(FVector(XCm, YCm, Gz + 130), FQuat(FRotator(0, FMath::RadiansToDegrees(H), 0)),
		ECC_Pawn, FCollisionShape::MakeBox(FVector(150, 90, 45)), Q);
}

void ARoverPawn::Enter(ACharacter* Walker)
{
	APlayerController* PC = Walker ? Cast<APlayerController>(Walker->GetController()) : nullptr;
	if (!PC || bDriven) return;
	Passenger = Walker;
	Walker->SetActorHiddenInGame(true);
	Walker->SetActorEnableCollision(false);
	Walker->SetActorTickEnabled(false);
	Walker->GetCharacterMovement()->DisableMovement();
	PC->Possess(this);
	EnteredAt = GetWorld()->GetTimeSeconds();
	bDriven = true; V = 0; Steer = 0; bHasY = false;
	SetFirstPerson(false);
	if (AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>())
		GM->Toast(Tr(TEXT("Ты за рулём. W/S — газ и тормоз, A/D — руль, Shift — быстрее, V — вид, E — выйти."),
			TEXT("You are driving. W/S throttle and reverse, A/D steer, Shift faster, V view, E get out.")));
}

void ARoverPawn::Exit()
{
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !Passenger) return;
	const FVector F(FMath::Cos(Heading), FMath::Sin(Heading), 0), R(-FMath::Sin(Heading), FMath::Cos(Heading), 0);
	static const double Spots[6][2] = { {0,210},{0,-210},{-290,0},{290,0},{0,320},{0,-320} };
	for (const auto& S : Spots)
	{
		const FVector P = GetActorLocation() * FVector(1, 1, 0) + F * S[0] + R * S[1];
		if (AOutpostWorld::InsideBase(P)) continue;
		const double Gz = OutpostWorld ? OutpostWorld->GroundZ(P.X, P.Y) : 0.0;
		FCollisionQueryParams Q(TEXT("RoverExit"), false, this);
		if (OutpostWorld && OutpostWorld->GetGround()) Q.AddIgnoredComponent(OutpostWorld->GetGround());
		if (GetWorld()->OverlapBlockingTestByChannel(FVector(P.X, P.Y, Gz + 110), FQuat::Identity, ECC_Pawn, FCollisionShape::MakeCapsule(34, 90), Q)) continue;
		Passenger->SetActorLocationAndRotation(FVector(P.X, P.Y, Gz + 100), FRotator(0, FMath::RadiansToDegrees(Heading), 0), false, nullptr, ETeleportType::TeleportPhysics);
		Passenger->SetActorHiddenInGame(false);
		Passenger->SetActorEnableCollision(true);
		Passenger->SetActorTickEnabled(true);
		Passenger->GetCharacterMovement()->SetMovementMode(MOVE_Falling);
		PC->Possess(Passenger);
		PC->SetControlRotation(FRotator(0, FMath::RadiansToDegrees(Heading), 0));
		Passenger = nullptr; bDriven = false; V = 0;
		DriverRoot->SetVisibility(false, true);
		return;
	}
}

void ARoverPawn::SetFirstPerson(bool bFp)
{
	bFirstPerson = bFp;
	ChaseCam->SetActive(!bFp);
	SeatCam->SetActive(bFp);
	DriverRoot->SetVisibility(bDriven && !bFp, true);
}

void ARoverPawn::Tick(float Dt)
{
	Super::Tick(Dt);
	Dt = FMath::Min(Dt, 0.05f);
	Clock += Dt;
	APlayerController* PC = bDriven ? Cast<APlayerController>(GetController()) : nullptr;
	if (!PC) return;

	if (AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>()) GM->PlayerTick(Dt, false); // the rover is not pressurised
	if (PC->WasInputKeyJustPressed(EKeys::E) && GetWorld()->GetTimeSeconds() - EnteredAt > 0.3) { Exit(); return; }
	if (PC->WasInputKeyJustPressed(EKeys::V)) SetFirstPerson(!bFirstPerson);
	auto Down = [&](const FKey& K) { return PC->IsInputKeyDown(K) ? 1.0 : 0.0; };
	const double Ix = FMath::Clamp(Down(EKeys::D) + Down(EKeys::Right) - Down(EKeys::A) - Down(EKeys::Left), -1.0, 1.0);
	const double Iy = FMath::Clamp(Down(EKeys::W) + Down(EKeys::Up) - Down(EKeys::S) - Down(EKeys::Down), -1.0, 1.0);
	const double VMax = (Down(EKeys::LeftShift) + Down(EKeys::RightShift)) > 0 ? 11.0 : 7.5;
	if (PC->WasInputKeyJustPressed(EKeys::SpaceBar)) V *= 0.3;

	// throttle, brake and coasting (m/s), same numbers as the web game
	if (Iy > 0) V += (V < 0 ? 7.0 : 3.4) * Iy * Dt;
	else if (Iy < 0) V += (V > 0 ? 7.0 : 2.2) * Iy * Dt;
	else V -= FMath::Sign(V) * FMath::Min(FMath::Abs(V), 1.8 * Dt);
	V = FMath::Clamp(V, -3.0, VMax);
	Steer += (Ix * 0.5 - Steer) * FMath::Min(1.0, Dt * 5.0);

	const double Dh = V * FMath::Tan(Steer) / 2.1 * Dt, Nh = Heading + Dh, D = V * Dt * 100.0;
	const FVector P = GetActorLocation();
	const double Nx = P.X + FMath::Cos(Nh) * D, Ny = P.Y + FMath::Sin(Nh) * D;
	if (Clear(Nx, Ny, Nh)) { Heading = Nh; Pose(Nx, Ny, Nh); }
	else V = 0;

	// slopes and crests: low gravity lets the rover hop
	const bool bMars = OutpostWorld && OutpostWorld->bMars;
	const double Gp = bMars ? 3.71 : 1.62;
	const double Tgt = OutpostWorld ? OutpostWorld->GroundZ(GetActorLocation().X, GetActorLocation().Y) / 100.0 : 0.0;
	if (!bHasY) { Y = Tgt; PrevT = Tgt; Vy = 0; bHasY = true; }
	V -= Gp * FMath::Sin(FMath::DegreesToRadians(Body->GetComponentRotation().Pitch)) * Dt * 1.6;
	Vy -= Gp * Dt; Y += Vy * Dt;
	if (Y <= Tgt) { const double Climb = (Tgt - PrevT) / FMath::Max((double)Dt, 1e-3); Y = Tgt; Vy = FMath::Clamp(Climb, 0.0, 1.5); Air = 0; }
	else Air += Dt;
	PrevT = Tgt;
	SetActorLocation(FVector(GetActorLocation().X, GetActorLocation().Y, Y * 100.0));
	if (Air > 0.15) Body->AddLocalRotation(FRotator(2.9 * FMath::Sin(Clock * 3), 0, 0)); // nose wobble in the air (Pose resets it each frame)

	// wheels spin with speed, front wheels steer
	Spin -= FMath::RadiansToDegrees(V * Dt / 0.41);
	for (auto& W : Parts)
	{
		if (!W.Key.StartsWith(TEXT("w"))) continue;
		const bool bFront = W.Key.StartsWith(TEXT("wF"));
		W.Value->SetRelativeRotation(FRotator(Spin, bFront ? FMath::RadiansToDegrees(Steer * 0.8) : 0.0, 0));
	}
	// in the seat view the mouse looks around
	float Mx = 0, My = 0; PC->GetInputMouseDelta(Mx, My);
	if (bFirstPerson)
	{
		FRotator Look = SeatCam->GetRelativeRotation();
		Look.Yaw = FMath::Clamp(Look.Yaw + Mx * 2.0, -110.0, 110.0);
		Look.Pitch = FMath::Clamp(Look.Pitch + My * 2.0, -60.0, 50.0);
		SeatCam->SetRelativeRotation(Look);
	}
}
