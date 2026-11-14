// Work stations: glowing rings where E opens a task.
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

// ---------------------------------------------------------------- work stations (glowing rings)
void AOutpostWorld::BuildStations()
{
	struct FDef { const TCHAR* Id; double X, Z; bool bIn; FLinearColor C; };
	const FDef Defs[] = {
		{TEXT("door"), 22.4, 0.35, true, FLinearColor(0.27f,0.48f,1.0f)},
		{TEXT("repair"), 19.6, -0.45, true, FLinearColor(1.0f,0.43f,0.16f)},
		{TEXT("bunks"), 0.7, 5.5, true, FLinearColor(0.27f,0.48f,1.0f)},
		{TEXT("comms"), -5.0, -3.9, true, FLinearColor(0.21f,0.65f,1.0f)},
		{TEXT("med"), 5.0, -3.8, true, FLinearColor(1.0f,0.27f,0.36f)},
		{TEXT("lab"), 1.2, -23.4, true, FLinearColor(0.27f,0.72f,0.14f)},
		{TEXT("greenhouse"), -28.4, 0, true, FLinearColor(0.27f,0.72f,0.14f)},
		{TEXT("battery"), 29.6, 10.6, false, FLinearColor(1.0f,0.66f,0.10f)},
		{TEXT("panels"), -17.5, 12.4, false, FLinearColor(0.21f,0.65f,1.0f)},
		{TEXT("shield"), 23.6, -19.6, false, FLinearColor(0.66f,0.26f,1.0f)},
		{TEXT("drill"), bMars ? 33.0 : 37.0, bMars ? 31.0 : 27.0, false, FLinearColor(0.27f,0.72f,0.14f)},
		{TEXT("radio"), 21.4, 20.6, false, FLinearColor(0.21f,0.65f,1.0f)},
	};
	for (const FDef& D : Defs)
	{
		FStation S; S.Id = D.Id; S.bIndoor = D.bIn; S.Color = D.C;
		double Floor = Terrain.Height(D.X, D.Z);
		if (D.bIn)
		{   // find the floor under the ring
			FHitResult Hit; const FVector From = U(D.X, D.Z, 1.5), To = U(D.X, D.Z, -1.0); // start below corridor roofs
			Floor = GetWorld()->LineTraceSingleByChannel(Hit, From, To, ECC_WorldStatic) ? Hit.ImpactPoint.Z / 100.0 : 0.3;
		}
		S.Where = U(D.X, D.Z, Floor);
		const double R = D.bIn ? 0.9 : 1.5;
		S.Ring = AddShape(this, RootComponent, TEXT("Cylinder"), S.Where + FVector(0, 0, 4), FVector(R * 2, R * 2, 0.02), FRotator::ZeroRotator, Glow(this, D.C, 0.35f), false);
		S.Ring->SetCastShadow(false);
		UStaticMeshComponent* Dot = AddShape(this, RootComponent, TEXT("Sphere"), S.Where + FVector(0, 0, D.bIn ? 185 : 300), FVector(D.bIn ? 0.22 : 0.45), FRotator::ZeroRotator, Glow(this, D.C, 0.85f), false);
		Dot->SetCastShadow(false);
		Stations.Add(S);
	}
}

