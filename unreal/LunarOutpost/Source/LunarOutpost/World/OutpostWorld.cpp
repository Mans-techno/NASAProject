// The outpost actor: set-up order, which places count as inside the base, stations lookup, the berm and per-frame animation.
#include "OutpostWorld.h"
#include "ProceduralMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "RoverPawn.h"
#include "CrewNPC.h"

using namespace Outpost;

AOutpostWorld::AOutpostWorld()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent->SetMobility(EComponentMobility::Movable);
}

UPrimitiveComponent* AOutpostWorld::GetGround() const { return Ground; }

bool AOutpostWorld::InsideBase(const FVector& P)
{
	// same zones as region() in the web game
	const double X = P.X / 100.0, Z = P.Y / 100.0;
	if (FMath::Sqrt(X * X + Z * Z) < 10.75) return true;
	if (FMath::Abs(Z) < 1.4 && X > 10.5 && X < 24.15) return true;
	if (FMath::Abs(Z) < 1.4 && X < -10.5 && X > -25.4) return true;
	if (FMath::Abs(X) < 1.4 && Z < -10.5 && Z > -22.6) return true;
	if (FMath::Sqrt((X - GH_X) * (X - GH_X) + Z * Z) < 8.75) return true;
	const double Cx = FMath::Clamp(X, -8.0, 8.0);
	return FMath::Sqrt((X - Cx) * (X - Cx) + (Z - LAB_Z) * (Z - LAB_Z)) < 2.45;
}

void AOutpostWorld::BeginPlay()
{
	Super::BeginPlay();
	Terrain.Init(bMars);
	BuildTerrain();
	BuildBase();
	BuildOutdoor();
	BuildSky();
	BuildStations();

	FActorSpawnParameters SP; SP.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	const FVector RoverAt = U(34, 8); 
	// deferred so the rover knows the terrain before its BeginPlay; the rover model faces +X
	Rover = GetWorld()->SpawnActorDeferred<ARoverPawn>(ARoverPawn::StaticClass(), FTransform(FRotator(0, Yaw(-0.8), 0), FVector(RoverAt.X, RoverAt.Y, GroundZ(RoverAt.X, RoverAt.Y))), nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	if (Rover) { Rover->OutpostWorld = this; Rover->FinishSpawning(FTransform(FRotator(0, Yaw(-0.8), 0), FVector(RoverAt.X, RoverAt.Y, GroundZ(RoverAt.X, RoverAt.Y)))); }
	const FLinearColor Tints[3] = { FLinearColor(0.035f, 0.10f, 0.40f), FLinearColor(0.15f, 0.08f, 0.48f), FLinearColor(0.04f, 0.32f, 0.10f) };
	for (int32 K = 0; K < 3; ++K)
	{
		ACrewNPC* N = GetWorld()->SpawnActor<ACrewNPC>(ACrewNPC::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator, SP);
		if (N) { N->Setup(this, K, Tints[K]); Crew.Add(N); }
	}
}

const FStation* AOutpostWorld::NearestStation(const FVector& P, bool bIndoor, double& OutDist) const
{
	const FStation* Best = nullptr; OutDist = 1e9;
	for (const FStation& S : Stations)
	{
		const bool bVisible = S.Id == TEXT("door") || S.bIndoor == bIndoor;
		if (!bVisible) continue;
		const double D = FVector::Dist2D(S.Where, P) / 100.0;
		const double Reach = S.bIndoor ? 1.9 : 3.2;
		if (D < Reach && D < OutDist) { OutDist = D; Best = &S; }
	}
	return Best;
}

void AOutpostWorld::AddBermLayer(int32 Layers)
{
	// a ring of regolith bags around the dome, leaving the three tunnel doors open
	UMaterialInterface* Bag = Paint(this, bMars ? FLinearColor(0.69f, 0.55f, 0.40f) : FLinearColor(0.78f, 0.76f, 0.72f), 0.95f);
	const int32 L = Layers - 1; const double R = 12.0 + L * 0.15, Y = 0.18 + L * 0.34;
	for (int32 K = 0; K < 64; ++K)
	{
		const double A = (K + (L % 2) * 0.5) / 64.0 * 2 * PI, X = FMath::Cos(A) * R, Z = FMath::Sin(A) * R;
		if ((X > 0 && FMath::Abs(Z) < 2.4) || (X < 0 && FMath::Abs(Z) < 2.4) || (Z < 0 && FMath::Abs(X) < 2.4)) continue;
		AddShape(this, RootComponent, TEXT("Cube"), U(X, Z, Terrain.Height(X, Z) + Y), FVector(1.1, 0.6, 0.34), FRotator(0, FMath::RadiansToDegrees(A) + 90, 0), Bag, true);
	}
}

void AOutpostWorld::SetSolarActive(int32 Panels) {}

void AOutpostWorld::Tick(float Dt)
{
	Super::Tick(Dt);
	Clock += Dt;
	if (DishHead) DishHead->AddLocalRotation(FRotator(0, FMath::Sin(Clock * 0.25) * 4.0 * Dt, 0));
	for (FStation& S : Stations)
		if (S.Ring) if (UMaterialInstanceDynamic* M = Cast<UMaterialInstanceDynamic>(S.Ring->GetMaterial(0)))
			M->SetScalarParameterValue(TEXT("Opacity"), 0.25f + 0.15f * FMath::Sin(Clock * 3.0));
}

