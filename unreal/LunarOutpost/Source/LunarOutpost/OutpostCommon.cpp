#include "OutpostCommon.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "PhysicsEngine/BodySetup.h"
#include "GameFramework/Actor.h"

namespace Outpost
{
	static bool GRu = true;
	static int32 GMissing = 0;
	bool IsRu() { return GRu; }
	void SetRu(bool bRu) { GRu = bRu; }
	int32 MissingAssets() { return GMissing; }

	// ---------- numbers that match the JavaScript version bit for bit ----------
	static int32 ToInt32(int64 V) { return (int32)(uint32)(uint64)V; }

	static double Hash(int64 X, int64 Y, int64 S)
	{
		int32 H = ToInt32(X * 374761393LL + Y * 668265263LL + S * 1442695041LL);
		const int32 T = H ^ (int32)((uint32)H >> 13);
		const double Prod = (double)T * 1274126177.0;   // JS multiplies in doubles, then |0
		H = ToInt32((int64)Prod);
		const uint32 R = (uint32)H ^ ((uint32)H >> 16);
		return (double)R / 4294967296.0;
	}

	static double VNoise(double X, double Y, int32 S)
	{
		const double XiD = FMath::FloorToDouble(X), YiD = FMath::FloorToDouble(Y);
		const int64 Xi = (int64)XiD, Yi = (int64)YiD;
		const double Xf = X - XiD, Yf = Y - YiD;
		const double U = Xf * Xf * (3 - 2 * Xf), V = Yf * Yf * (3 - 2 * Yf);
		const double A = Hash(Xi, Yi, S), B = Hash(Xi + 1, Yi, S), C = Hash(Xi, Yi + 1, S), D = Hash(Xi + 1, Yi + 1, S);
		return A + (B - A) * U + (C - A) * V + (A - B - C + D) * U * V;
	}

	double Fbm(double X, double Y, int32 S, int32 Octaves)
	{
		double F = 0, Amp = 0.5, Fr = 1;
		for (int32 I = 0; I < Octaves; ++I) { F += Amp * VNoise(X * Fr, Y * Fr, S + I * 17); Fr *= 2.03; Amp *= 0.5; }
		return F;
	}

	double SmoothStep(double A, double B, double X)
	{
		const double T = FMath::Clamp((X - A) / (B - A), 0.0, 1.0);
		return T * T * (3 - 2 * T);
	}

	double FMulberry::Next()
	{
		A += 0x6D2B79F5u;
		uint32 T = (A ^ (A >> 15)) * (1u | A);
		T = (T + ((T ^ (T >> 7)) * (61u | T))) ^ T;
		return (double)(T ^ (T >> 14)) / 4294967296.0;
	}

	// ---------- terrain ----------
	static const double FootPrints[][3] = { {0,0,16}, {-33.4,0,13}, {0,-24,12}, {18,0,6}, {-18,0,6}, {0,-16,6}, {-52,-44,10} };

	void FTerrain::Init(bool bInMars)
	{
		bMars = bInMars;
		Craters.Reset();
		FMulberry R(bMars ? 91 : 57);
		const int32 N = bMars ? 26 : 90;
		for (int32 K = 0; K < N; ++K)
		{
			const double A = R.Next() * PI * 2, D = 60 + R.Next() * 320;
			const double Rad = (bMars ? 3 : 2) + FMath::Pow(R.Next(), 2.0) * (bMars ? 18 : 26);
			Craters.Add(FVector(FMath::Cos(A) * D, FMath::Sin(A) * D, Rad));
		}
		Craters.Add(FVector(-70, 90, 30)); Craters.Add(FVector(110, -70, 22)); Craters.Add(FVector(-150, -160, 48));
	}

	double FTerrain::Height(double X, double Z) const
	{
		const int32 Seed = bMars ? 7 : 3;
		const double D = FMath::Sqrt(X * X + Z * Z);
		const double Amp = 0.35 + 0.65 * SmoothStep(30, 140, D);
		double H = bMars ? (Fbm(X / 40, Z / 40, Seed, 5) - 0.5) * 9 + FMath::Sin(X / 9 + Fbm(X / 30, Z / 30, Seed + 3, 3) * 4) * 0.6
		                 : (Fbm(X / 34, Z / 34, Seed, 6) - 0.5) * 7;
		H *= Amp;
		for (const FVector& C : Craters)
		{
			const double Q = FMath::Sqrt((X - C.X) * (X - C.X) + (Z - C.Y) * (Z - C.Y)) / C.Z;
			if (Q < 1.6) H += Q < 1 ? -C.Z * 0.32 * (1 - Q * Q) + C.Z * 0.1 * Q * Q * Q : C.Z * 0.1 * FMath::Exp(-(Q - 1) * (Q - 1) * 12);
		}
		if (!bMars)
		{   // polar massifs on the horizon, and the floor of Shackleton falling away to the south-west
			H += FMath::Pow(FMath::Max(0.0, D - 200) / 250, 1.6) * 120 * (0.35 + Fbm(X / 90, Z / 90, 11, 4));
			const double Sh = FMath::Sqrt((X + 330) * (X + 330) + (Z + 300) * (Z + 300));
			if (Sh < 260) H -= (1 - Sh / 260) * (1 - Sh / 260) * 90;
		}
		else
		{
			H += FMath::Max(0.0, Fbm(X / 70, Z / 70, 13, 3) - 0.52) * 90 * SmoothStep(110, 190, D);
			H += FMath::Pow(FMath::Max(0.0, D - 260) / 190, 2.0) * 70 * Fbm(X / 120, Z / 120, 17, 3);
		}
		double M = 1e9;
		for (const auto& F : FootPrints) M = FMath::Min(M, FMath::Sqrt((X - F[0]) * (X - F[0]) + (Z - F[1]) * (Z - F[1])) - F[2]);
		const double Fl = SmoothStep(0, 16, M);
		return H * Fl - 0.03 * (1 - Fl);
	}

	// ---------- assets ----------
	struct FPartRow { const TCHAR* Asset; const TCHAR* Mesh; FVector Loc; FQuat Rot; FVector Scale; };
	static const FPartRow GParts[] = {
#include "OutpostParts.inl"
	};

	static void UseRealTriangles(UStaticMesh* Mesh)
	{
		// Walls, floors and furniture should block exactly where they are drawn
		if (!Mesh) return;
		UBodySetup* BS = Mesh->GetBodySetup();
		if (!BS) { Mesh->CreateBodySetup(); BS = Mesh->GetBodySetup(); }
		if (BS && BS->CollisionTraceFlag != CTF_UseComplexAsSimple)
		{
			BS->CollisionTraceFlag = CTF_UseComplexAsSimple;
			BS->InvalidatePhysicsData();
			BS->CreatePhysicsMeshes();
		}
	}

	UStaticMesh* LoadMesh(const FString& Name)
	{
		static TMap<FString, UStaticMesh*> Cache;
		if (UStaticMesh** Found = Cache.Find(Name)) return *Found;
		UStaticMesh* M = LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Game/Outpost/Meshes/%s.%s"), *Name, *Name));
		if (!M) { ++GMissing; UE_LOG(LogTemp, Warning, TEXT("Outpost: mesh %s not found. Run Scripts/import_models.py in the editor first."), *Name); }
		Cache.Add(Name, M);
		return M;
	}

	UMaterialInterface* LoadMaterial(const FString& Name)
	{
		static TMap<FString, UMaterialInterface*> Cache;
		if (UMaterialInterface** Found = Cache.Find(Name)) return *Found;
		UMaterialInterface* M = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Outpost/Materials/%s.%s"), *Name, *Name));
		if (!M) M = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
		Cache.Add(Name, M);
		return M;
	}

	UStaticMesh* EngineShape(const TCHAR* Shape)
	{
		return LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Engine/BasicShapes/%s.%s"), Shape, Shape));
	}

	UMaterialInstanceDynamic* Paint(UObject* Outer, const FLinearColor& Color, float Roughness)
	{
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(LoadMaterial(TEXT("M_Paint")), Outer);
		M->SetVectorParameterValue(TEXT("Color"), Color);
		M->SetScalarParameterValue(TEXT("Roughness"), Roughness);
		return M;
	}

	UMaterialInstanceDynamic* Glow(UObject* Outer, const FLinearColor& Color, float Opacity)
	{
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(LoadMaterial(TEXT("M_Glow")), Outer);
		M->SetVectorParameterValue(TEXT("Color"), Color);
		M->SetScalarParameterValue(TEXT("Opacity"), Opacity);
		return M;
	}

	static UStaticMeshComponent* NewMeshComp(AActor* Owner, USceneComponent* Parent, UStaticMesh* Mesh, bool bCollide)
	{
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(Owner);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(Mesh);
		C->SetupAttachment(Parent);
		C->SetCollisionProfileName(bCollide ? TEXT("BlockAll") : TEXT("NoCollision"));
		C->RegisterComponent();
		Owner->AddInstanceComponent(C);
		return C;
	}

	TMap<FString, UStaticMeshComponent*> AddModel(AActor* Owner, USceneComponent* Parent, const FString& Asset, bool bCollide)
	{
		TMap<FString, UStaticMeshComponent*> Out;
		for (const FPartRow& Row : GParts)
		{
			if (Asset != Row.Asset) continue;
			UStaticMesh* Mesh = LoadMesh(Row.Mesh);
			if (!Mesh) continue;
			if (bCollide) UseRealTriangles(Mesh);
			UStaticMeshComponent* C = NewMeshComp(Owner, Parent, Mesh, bCollide);
			C->SetRelativeTransform(FTransform(Row.Rot, Row.Loc, Row.Scale));
			FString Part = Row.Mesh;
			int32 Sep = Part.Find(TEXT("__"));
			if (Sep != INDEX_NONE) Part = Part.Mid(Sep + 2);
			Out.Add(Part, C);
		}
		return Out;
	}

	UStaticMeshComponent* AddShape(AActor* Owner, USceneComponent* Parent, const TCHAR* Shape, const FVector& LocCm, const FVector& SizeM, const FRotator& Rot, UMaterialInterface* Mat, bool bCollide)
	{
		UStaticMeshComponent* C = NewMeshComp(Owner, Parent, EngineShape(Shape), bCollide);
		C->SetRelativeLocationAndRotation(LocCm, Rot);
		C->SetRelativeScale3D(SizeM); // engine shapes are 1 m across
		if (Mat) C->SetMaterial(0, Mat);
		return C;
	}

	void AnimatePerson(const TMap<FString, UStaticMeshComponent*>& Parts, double Phase, double Amp, bool bWork)
	{
		// The models face +Y (Blender -Y), so swinging a limb forward is a rotation about the X axis (roll)
		const double S = FMath::Sin(Phase) * Amp;
		auto Swing = [&](const TCHAR* Name, double Rad)
		{
			if (UStaticMeshComponent* const* C = Parts.Find(Name)) (*C)->SetRelativeRotation(FRotator(0, 0, FMath::RadiansToDegrees(Rad)));
		};
		Swing(TEXT("legL"), S); Swing(TEXT("legR"), -S);
		Swing(TEXT("armL"), bWork ? -0.9 + FMath::Sin(Phase * 1.7) * 0.35 : -S * 0.8);
		Swing(TEXT("armR"), bWork ? -1.1 + FMath::Cos(Phase * 1.7) * 0.35 : S * 0.8);
		if (UStaticMeshComponent* const* H = Parts.Find(TEXT("head")))
			(*H)->SetRelativeRotation(FRotator(0, bWork ? FMath::RadiansToDegrees(FMath::Sin(Phase * 0.4) * 0.25) : 0.0, 0));
	}
}
