// Outdoor work sites: antenna, drill, quarry with the bagging line, solar panels, batteries, path lights, signs.
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

// ---------------------------------------------------------------- outdoor sites
void AOutpostWorld::BuildOutdoor()
{
	Place(TEXT("dish"), 24, 24, -2.3, true);
	Place(TEXT("drill"), bMars ? 36 : 40, bMars ? 34 : 30, 0, true);
	Place(TEXT("excavator"), 31.2, -20.8, 2.36, true);
	const double Crates[][2] = { {27,-6},{28.2,-6.6},{26.8,-7.4},{-46,-34},{-47.2,-35},{-45.4,-36} };
	for (int32 K = 0; K < 6; ++K) Place(TEXT("crate"), Crates[K][0], Crates[K][1], K * 0.7, true);
	for (int32 K = 0; K < 8; ++K) { const int32 Row = K >> 2, Colm = K & 3; Place(TEXT("solar"), -20 - Colm * 5.4 - (Row & 1) * 1.6, 16 + Row * 4.8, 0, true); }
	for (int32 K = 0; K < 4; ++K) Place(TEXT("battery"), 29.5 + (K % 4) * 2.1, 13.4 + (K / 4) * 1.7, 0, true);

	// path lights from the airlock to each work site
	const double Paths[][4] = { {26,0,26,20},{26,0,26,-20},{26,0,36,26},{26,0,32,6},{26,0,50,-36},{26,2,29,10},{-12,12,-18,12},{24,6,-10,13},{-30,12,-48,-38} };
	for (const auto& P : Paths)
	{
		const int32 N = FMath::Max(2, FMath::RoundToInt(FMath::Sqrt((P[2] - P[0]) * (P[2] - P[0]) + (P[3] - P[1]) * (P[3] - P[1])) / 7));
		for (int32 K = 1; K < N; ++K)
		{
			const double X = P[0] + (P[2] - P[0]) * K / N, Z = P[1] + (P[3] - P[1]) * K / N, D = FMath::Sqrt(X * X + Z * Z);
			if (InsideBase(U(X, Z)) || (D < 24 && D > 10)) continue;
			Place(TEXT("pathlight"), X, Z, 0, true, 0, false);
		}
	}

	// regolith quarry: the pile, the excavator, a hopper, a belt to the bagger and filled bags on pallets
	const double Qx = 28, Qz = -24;
	UMaterialInterface* Reg = Paint(this, bMars ? FLinearColor(0.32f, 0.11f, 0.05f) : FLinearColor(0.16f, 0.165f, 0.175f), 1.0f);
	AddShape(this, RootComponent, TEXT("Sphere"), U(Qx, Qz, Terrain.Height(Qx, Qz) - 0.15), FVector(8.8, 8.8, 4.8), FRotator::ZeroRotator, Reg, true);
	UMaterialInterface* Steel = Paint(this, FLinearColor(0.32f, 0.35f, 0.40f), 0.45f);
	UMaterialInterface* Dark = Paint(this, FLinearColor(0.025f, 0.03f, 0.045f), 0.6f);
	UMaterialInterface* Yellow = Paint(this, FLinearColor(0.88f, 0.44f, 0.03f), 0.5f);
	UMaterialInterface* Bag = Paint(this, bMars ? FLinearColor(0.69f, 0.55f, 0.40f) : FLinearColor(0.78f, 0.76f, 0.72f), 0.95f);
	UMaterialInterface* Strap = Paint(this, FLinearColor(0.04f, 0.15f, 0.64f), 0.7f);
	UMaterialInterface* Wood = Paint(this, FLinearColor(0.25f, 0.19f, 0.10f), 0.9f);
	auto G = [&](double X, double Z, double Dy) { return U(X, Z, Terrain.Height(X, Z) + Dy); };
	const double Hx = 25.2, Hz = -21.4;
	for (int32 I = -1; I <= 1; I += 2) for (int32 J = -1; J <= 1; J += 2)
		AddShape(this, RootComponent, TEXT("Cylinder"), G(Hx + I * 0.7, Hz + J * 0.7, 1.0), FVector(0.12, 0.12, 2.0), FRotator::ZeroRotator, Steel, true);
	AddShape(this, RootComponent, TEXT("Cube"), G(Hx, Hz, 2.5), FVector(1.8, 1.8, 1.0), FRotator::ZeroRotator, Yellow, true);
	const double Bx = 22.4, Bz = -19.2;
	const FVector A = G(Hx, Hz, 1.6), B = G(Bx, Bz, 1.2), Mid = (A + B) / 2, Dir = B - A;
	AddShape(this, RootComponent, TEXT("Cube"), Mid, FVector(Dir.Size() / 100.0, 0.7, 0.12), Dir.Rotation(), Dark, true);
	AddShape(this, RootComponent, TEXT("Cube"), G(Bx, Bz, 0.65), FVector(1.4, 1.2, 1.3), FRotator::ZeroRotator, Paint(this, FLinearColor(0.68f, 0.71f, 0.76f), 0.5f), true);
	AddShape(this, RootComponent, TEXT("Sphere"), G(Bx, Bz, 1.4), FVector(0.18), FRotator::ZeroRotator, Glow(this, FLinearColor(0.2f, 1.0f, 0.4f), 1.0f), false);
	const double Pallets[2][2] = { {20.2,-17.2},{20.4,-15.3} };
	for (const auto& P : Pallets)
	{
		AddShape(this, RootComponent, TEXT("Cube"), G(P[0], P[1], 0.07), FVector(2.0, 1.3, 0.14), FRotator::ZeroRotator, Wood, true);
		for (int32 L = 0; L < 3; ++L) for (int32 I = 0; I < 2; ++I) for (int32 J = 0; J < 2; ++J)
		{
			if (L == 2 && I + J > 1) continue;
			const FVector At = G(P[0] - 0.48 + I * 0.96, P[1] - 0.3 + J * 0.6, 0.31 + L * 0.32);
			AddShape(this, RootComponent, TEXT("Cube"), At, FVector(0.9, 0.55, 0.3), FRotator(0, (L % 2) * 2.0, 0), Bag, false);
			AddShape(this, RootComponent, TEXT("Cube"), At, FVector(0.06, 0.57, 0.32), FRotator(0, (L % 2) * 2.0, 0), Strap, false);
		}
	}
	// outdoor signs face the airlock
	auto OutSign = [&](const TCHAR* Key, double X, double Z)
	{
		const double Ry = FMath::Atan2(26 - X, 0 - Z); // three.js: the sign's front looks back towards the airlock
		const FVector2D Face(FMath::Sin(Ry), FMath::Cos(Ry));
		const double Deg = FMath::RadiansToDegrees(FMath::Atan2(Face.Y, Face.X));
		Sign(Key, G(X, Z, 0), Deg - 90.0, 2.6, 0.81, true);
	};
	OutSign(TEXT("quarry"), 22.0, -14.6);
	OutSign(TEXT("drill"), (bMars ? 36 : 40) - 2.6, (bMars ? 34 : 30) - 3.0);
	OutSign(TEXT("battery"), 27.2, 8.6);
	OutSign(TEXT("solar"), -14.4, 9.6);
	OutSign(TEXT("radio"), 19.0, 18.2);
}

