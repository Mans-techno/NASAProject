// Sky: the Sun, sky light, stars and the Earth.
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

// ---------------------------------------------------------------- sky: Sun, stars, Earth
void AOutpostWorld::BuildSky()
{
	// Low polar Sun: long shadows like at the lunar south pole
	const FRotator SunRot(-9.0, 135.0, 0);
	UDirectionalLightComponent* Sun = NewObject<UDirectionalLightComponent>(this, TEXT("Sun"));
	Sun->SetupAttachment(RootComponent); Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetIntensity(10.0f); Sun->SetLightColor(FLinearColor(1.0f, 0.97f, 0.92f));
	Sun->RegisterComponent(); AddInstanceComponent(Sun);
	Sun->SetWorldRotation(SunRot);
	const FVector ToSun = -SunRot.Vector();
	AddShape(this, RootComponent, TEXT("Sphere"), ToSun * 260000.0, FVector(45), FRotator::ZeroRotator, LoadMaterial(TEXT("M_E_sun")), false);

	// a little ambient light, the way sunlight bounces off bright regolith
	USkyLightComponent* Sky = NewObject<USkyLightComponent>(this, TEXT("Bounce"));
	Sky->SetupAttachment(RootComponent); Sky->SetMobility(EComponentMobility::Movable);
	Sky->SetIntensity(0.25f); Sky->bLowerHemisphereIsBlack = false; Sky->SetLowerHemisphereColor(FLinearColor(0.35f, 0.35f, 0.37f));
	Sky->RegisterComponent(); AddInstanceComponent(Sky);

	if (UStaticMesh* Ball = EngineShape(TEXT("Sphere")))
	{
		UInstancedStaticMeshComponent* Stars = NewObject<UInstancedStaticMeshComponent>(this, TEXT("Stars"));
		Stars->SetStaticMesh(Ball); Stars->SetupAttachment(RootComponent); Stars->SetMobility(EComponentMobility::Movable);
		Stars->SetCollisionEnabled(ECollisionEnabled::NoCollision); Stars->SetCastShadow(false);
		Stars->SetMaterial(0, LoadMaterial(TEXT("M_E_star")));
		Stars->RegisterComponent(); AddInstanceComponent(Stars);
		FMulberry R(77);
		for (int32 I = 0; I < 1800; ++I)
		{
			FVector D(R.Next() * 2 - 1, R.Next() * 2 - 1, R.Next() * 0.98 + 0.02);
			if (I % 3 == 0) { const double T = R.Next() * PI * 2; D = FVector(FMath::Cos(T), FMath::Sin(T), 0.08 + R.Next() * 0.35); } // Milky Way band
			Stars->AddInstance(FTransform(FRotator::ZeroRotator, D.GetSafeNormal() * 250000.0, FVector(1.2 + R.Next() * 2.0)));
		}
	}
	// Earth hangs low over the horizon, about 2 degrees across
	const FVector EarthDir = FRotator(4.0, -60.0, 0).Vector();
	AddShape(this, RootComponent, TEXT("Sphere"), EarthDir * 200000.0, FVector(70), FRotator::ZeroRotator, LoadMaterial(TEXT("M_Earth")), false);
}

