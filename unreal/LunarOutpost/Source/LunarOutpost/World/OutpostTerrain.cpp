// Terrain: the same mountains and craters as the web game, as a procedural mesh, plus scattered rocks.
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

// ---------------------------------------------------------------- terrain
void AOutpostWorld::BuildTerrain()
{
	const int32 Seg = 300; const double Size = 900.0, Ts = Size / Seg; const int32 Tn = Seg + 1;
	TArray<FVector> V; TArray<int32> Tri; TArray<FVector> N; TArray<FVector2D> UV; TArray<FColor> Col; TArray<FProcMeshTangent> Tan;
	V.SetNum(Tn * Tn); N.SetNum(Tn * Tn); UV.SetNum(Tn * Tn); Col.SetNum(Tn * Tn);
	TArray<double> H; H.SetNum(Tn * Tn);
	for (int32 Iz = 0; Iz < Tn; ++Iz) for (int32 Ix = 0; Ix < Tn; ++Ix)
		H[Iz * Tn + Ix] = Terrain.Height(-Size / 2 + Ix * Ts, -Size / 2 + Iz * Ts);
	const FLinearColor C1 = FLinearColor(FColor(0x8a, 0x8c, 0x90)), C2 = FLinearColor(FColor(0x55, 0x57, 0x5c)), C3 = FLinearColor(FColor(0xa9, 0xab, 0xb0));
	const FLinearColor M1 = FLinearColor(FColor(0xb5, 0x64, 0x3a)), M2 = FLinearColor(FColor(0x6e, 0x34, 0x20)), M3 = FLinearColor(FColor(0xd0, 0x8a, 0x58));
	for (int32 Iz = 0; Iz < Tn; ++Iz) for (int32 Ix = 0; Ix < Tn; ++Ix)
	{
		const int32 I = Iz * Tn + Ix; const double X = -Size / 2 + Ix * Ts, Z = -Size / 2 + Iz * Ts;
		V[I] = U(X, Z, H[I]);
		const double Hx = H[Iz * Tn + FMath::Min(Ix + 1, Seg)] - H[Iz * Tn + FMath::Max(Ix - 1, 0)];
		const double Hz = H[FMath::Min(Iz + 1, Seg) * Tn + Ix] - H[FMath::Max(Iz - 1, 0) * Tn + Ix];
		N[I] = FVector(-Hx, -Hz, 2 * Ts).GetSafeNormal();
		UV[I] = FVector2D(X / 4.0, Z / 4.0);
		const double Nn = Fbm(X / 14, Z / 14, bMars ? 31 : 33, 4);
		FLinearColor C = FMath::Lerp(bMars ? M2 : C2, bMars ? M1 : C1, (float)FMath::Min(1.0, Nn * 1.3));
		if (Nn > 0.62) C = FMath::Lerp(C, bMars ? M3 : C3, (float)((Nn - 0.62) * 2.2));
		Col[I] = C.ToFColor(false); // linear values, the material reads vertex colour as-is
	}
	Tri.Reserve(Seg * Seg * 6);
	for (int32 Iz = 0; Iz < Seg; ++Iz) for (int32 Ix = 0; Ix < Seg; ++Ix)
	{
		const int32 A = Iz * Tn + Ix, B = (Iz + 1) * Tn + Ix, C = (Iz + 1) * Tn + Ix + 1, D = Iz * Tn + Ix + 1;
		Tri.Append({ A, B, D, B, C, D }); // same split as the web game's walkable triangles
	}
	Ground = NewObject<UProceduralMeshComponent>(this, TEXT("Terrain"));
	Ground->SetupAttachment(RootComponent);
	Ground->bUseComplexAsSimpleCollision = true;
	Ground->RegisterComponent();
	Ground->CreateMeshSection(0, V, Tri, N, UV, Col, Tan, true);
	Ground->SetMaterial(0, LoadMaterial(TEXT("M_Regolith")));
	Ground->SetCollisionProfileName(TEXT("BlockAll"));
	AddInstanceComponent(Ground);

	// scattered rocks (same random sequence as the web game)
	if (UStaticMesh* RockMesh = LoadMesh(TEXT("rock__rock")))
	{
		UInstancedStaticMeshComponent* Rocks = NewObject<UInstancedStaticMeshComponent>(this, TEXT("Rocks"));
		Rocks->SetStaticMesh(RockMesh); Rocks->SetupAttachment(RootComponent); Rocks->SetMobility(EComponentMobility::Movable);
		Rocks->SetCollisionProfileName(TEXT("BlockAll")); Rocks->RegisterComponent(); AddInstanceComponent(Rocks);
		FMulberry R(bMars ? 5 : 6);
		const double Keep[][3] = { {0,0,20},{GH_X,0,17},{0,-24,16},{18,0,10},{-18,0,10},{0,-16,10},{-52,-44,14},{24,24,5},{34,8,5},{40,30,6},{36,34,6},{28,-24,8},{54,-42,9},{-28,23,16} };
		for (int32 K = 0; K < 520; ++K)
		{
			double X, Z; bool bOk;
			do { X = (R.Next() - 0.5) * 760; Z = (R.Next() - 0.5) * 760; bOk = true; for (const auto& Kp : Keep) if (FMath::Sqrt((X - Kp[0]) * (X - Kp[0]) + (Z - Kp[1]) * (Z - Kp[1])) < Kp[2]) { bOk = false; break; } } while (!bOk);
			const double S = 0.25 + FMath::Pow(R.Next(), 3.0) * 2.6 * (FMath::Sqrt(X * X + Z * Z) > 120 ? 1.8 : 1);
			const FRotator Rot(R.Next() * 170, R.Next() * 170, R.Next() * 170);
			Rocks->AddInstance(FTransform(Rot, U(X, Z, Terrain.Height(X, Z) + S * 0.2), FVector(S)));
		}
	}
}

