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

static const double GH_X = -33.4, LAB_Z = -24.0;

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
