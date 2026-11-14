// The habitat: dome, tunnels, greenhouse, lab, furniture models, signs and indoor lights.
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

// ---------------------------------------------------------------- helpers
void AOutpostWorld::Place(const FString& Asset, double X, double Zg, double Ry, bool bOnGround, double Y, bool bCollide)
{
	USceneComponent* Pivot = NewObject<USceneComponent>(this);
	Pivot->SetMobility(EComponentMobility::Movable);
	Pivot->SetupAttachment(RootComponent);
	Pivot->RegisterComponent(); AddInstanceComponent(Pivot);
	const double Z = bOnGround ? Terrain.Height(X, Zg) : Y;
	Pivot->SetRelativeLocationAndRotation(U(X, Zg, Z), FRotator(0, Yaw(Ry), 0));
	TMap<FString, UStaticMeshComponent*> Parts = AddModel(this, Pivot, Asset, bCollide);
	if (Asset == TEXT("dish")) { if (UStaticMeshComponent** H = Parts.Find(TEXT("head"))) DishHead = *H; }
	if (Asset == TEXT("solar")) { if (UStaticMeshComponent** A = Parts.Find(TEXT("array"))) SolarArrays.Add(*A); }
}

void AOutpostWorld::Sign(const FString& Key, const FVector& LocCm, double YawDeg, double WidthM, double HeightM, bool bPosts)
{
	USceneComponent* Pivot = NewObject<USceneComponent>(this);
	Pivot->SetMobility(EComponentMobility::Movable); Pivot->SetupAttachment(RootComponent); Pivot->RegisterComponent(); AddInstanceComponent(Pivot);
	Pivot->SetRelativeLocationAndRotation(LocCm, FRotator(0, YawDeg, 0));
	UMaterialInterface* Dark = Paint(this, FLinearColor(0.02f, 0.025f, 0.035f), 0.6f);
	TMap<FString, UStaticMeshComponent*> Q = AddModel(this, Pivot, TEXT("sign"), false);
	const double Up = bPosts ? 210.0 : 0.0;
	if (UStaticMeshComponent** Quad = Q.Find(TEXT("sign")))
	{
		(*Quad)->SetRelativeLocation(FVector(0, 1.5, Up));
		(*Quad)->SetRelativeScale3D(FVector(WidthM, 1, HeightM));
		(*Quad)->SetMaterial(0, LoadMaterial(TEXT("M_Sign_") + Key));
	}
	AddShape(this, Pivot, TEXT("Cube"), FVector(0, -2, Up), FVector(WidthM + 0.08, 0.04, HeightM + 0.08), FRotator::ZeroRotator, Dark, false);
	if (bPosts)
		for (int32 S = -1; S <= 1; S += 2)
			AddShape(this, Pivot, TEXT("Cylinder"), FVector(S * (WidthM * 50 - 8), -4, 130), FVector(0.1, 0.1, 2.6), FRotator::ZeroRotator, Dark, true);
}

// ---------------------------------------------------------------- the base
void AOutpostWorld::BuildBase()
{
	Place(TEXT("hab"), 0, 0, 0, false);
	Place(TEXT("corr_air"), 10.8, 0, 0, false);
	Place(TEXT("corr_gh"), -10.8, 0, PI, false);
	Place(TEXT("corr_lab"), 0, -10.8, PI / 2, false);
	Place(TEXT("greenhouse"), GH_X, 0, 0, false);
	Place(TEXT("lab"), 0, LAB_Z, 0, false);
	const double Beds[4][2] = { {2.8,1.8},{-2.8,1.8},{2.8,-1.8},{-2.8,-1.8} };
	for (const auto& B : Beds) Place(TEXT("bed"), GH_X + B[0], B[1], 0, false, 0.25);

	// tunnel-to-lab junction: a short ramp up to the lab floor with side walls and a roof (the web game's portal collar)
	UMaterialInterface* Panel = Paint(this, FLinearColor(0.55f, 0.57f, 0.62f), 0.5f);
	UMaterialInterface* Floor = Paint(this, FLinearColor(0.09f, 0.10f, 0.12f), 0.75f);
	AddShape(this, RootComponent, TEXT("Cube"), U(0, -21.25, 0.33), FVector(3.2, 1.45, 0.2), FRotator(0, 0, 19.0), Floor, true);
	for (int32 S = -1; S <= 1; S += 2) AddShape(this, RootComponent, TEXT("Cube"), U(S * 1.7, -21.3, 1.6), FVector(0.2, 1.6, 3.2), FRotator::ZeroRotator, Panel, true);
	AddShape(this, RootComponent, TEXT("Cube"), U(0, -21.3, 3.05), FVector(3.6, 1.6, 0.2), FRotator::ZeroRotator, Panel, true);

	// room signs hang over each room entrance, doors get their own sign
	struct FRoom { const TCHAR* Key; double A0, A1, Lerp; };
	const FRoom Rooms[] = { {TEXT("galley"),20,62,0.5}, {TEXT("bunks"),62,145,0.5}, {TEXT("gym"),145,195,0.32}, {TEXT("med"),-62,-22,0.5}, {TEXT("comms"),-165,-112,0.5} };
	for (const FRoom& R : Rooms)
	{
		const double A0 = FMath::DegreesToRadians(R.A0), A1 = FMath::DegreesToRadians(R.A1);
		const FVector2D P0(FMath::Cos(A0) * 6, FMath::Sin(A0) * 6), P1(FMath::Cos(A1) * 6, FMath::Sin(A1) * 6);
		const FVector2D M = (P0 + (P1 - P0) * R.Lerp) * 0.985;
		const double Theta = FMath::RadiansToDegrees(FMath::Atan2(M.Y, M.X));
		Sign(R.Key, U(M.X, M.Y, 2.62), Theta + 90.0, 2.4, 0.45, false);
	}
	const struct { const TCHAR* Key; double Deg; } Doors[] = { {TEXT("airlock"),0}, {TEXT("greenhouse"),180}, {TEXT("lab"),-90} };
	for (const auto& D : Doors)
	{
		const double A = FMath::DegreesToRadians(D.Deg);
		Sign(D.Key, U(FMath::Cos(A) * 9.8, FMath::Sin(A) * 9.8, 3.5), D.Deg + 90.0, 2.4, 0.45, false);
	}

	// interior lights
	auto Lamp = [&](double X, double Z, double Y, FLinearColor C, float Lumens, float RadiusM)
	{
		UPointLightComponent* L = NewObject<UPointLightComponent>(this);
		L->SetupAttachment(RootComponent); L->SetMobility(EComponentMobility::Movable);
		L->SetIntensityUnits(ELightUnits::Lumens); L->SetIntensity(Lumens); L->SetLightColor(C);
		L->SetAttenuationRadius(RadiusM * 100); L->SetCastShadows(false);
		L->RegisterComponent(); AddInstanceComponent(L);
		L->SetRelativeLocation(U(X, Z, Y));
	};
	const FLinearColor Warm(1.0f, 0.94f, 0.86f), Cool(0.9f, 0.95f, 1.0f);
	Lamp(0, 0, 6.4, Warm, 6000, 24);
	for (int32 K = 0; K < 6; ++K) { const double A = K * PI / 3 + 0.5; Lamp(FMath::Cos(A) * 8, FMath::Sin(A) * 8, 2.8, Warm, 1500, 7); }
	Lamp(-5, LAB_Z, 5.0, Cool, 2500, 10); Lamp(5, LAB_Z, 5.0, Cool, 2500, 10);
	Lamp(17, 0, 2.6, Warm, 1200, 10); Lamp(-17, 0, 2.6, Warm, 1200, 10); Lamp(0, -16, 2.6, Warm, 1200, 10);
	Lamp(GH_X, 0, 5.5, FLinearColor(1.0f, 0.55f, 0.88f), 5000, 20); Lamp(GH_X, 0, 3.0, Warm, 1500, 14);
	Lamp(26.5, 0, 3.0, FLinearColor(1.0f, 0.88f, 0.63f), 1500, 16);
}

