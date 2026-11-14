// Shared helpers: coordinate conversion from the web game, the terrain height function (same maths as the
// web version, so the same mountains and craters), and loading of the Blender models imported by Scripts/import_models.py.
#pragma once

#include "CoreMinimal.h"

class AActor;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;

namespace Outpost
{
	// Web game space: metres, x east, z = three.js z, y up.  Unreal: centimetres, X east, Y = three.js z, Z up.
	inline FVector U(double X, double Zg, double Y = 0.0) { return FVector(X * 100.0, Zg * 100.0, Y * 100.0); }
	// three.js rotation.y (radians) -> Unreal yaw (degrees)
	inline double Yaw(double RyThree) { return -FMath::RadiansToDegrees(RyThree); }

	// Language: Russian by default, L toggles English
	bool IsRu();
	void SetRu(bool bRu);
	inline FString Tr(const TCHAR* Ru, const TCHAR* En) { return IsRu() ? FString(Ru) : FString(En); }

	// JS-compatible random numbers (mulberry32) and value noise
	struct FMulberry
	{
		uint32 A;
		explicit FMulberry(uint32 Seed) : A(Seed) {}
		double Next();
	};
	double Fbm(double X, double Y, int32 S, int32 Octaves = 5);
	double SmoothStep(double A, double B, double X);

	// Terrain height in metres at web-space (X, Zg)
	struct FTerrain
	{
		bool bMars = false;
		TArray<FVector> Craters; // x, z, radius
		void Init(bool bInMars);
		double Height(double X, double Zg) const;
	};

	UStaticMesh* LoadMesh(const FString& Name);
	UMaterialInterface* LoadMaterial(const FString& Name);
	UStaticMesh* EngineShape(const TCHAR* Shape); // Cube, Sphere, Cylinder, Cone, Plane
	UMaterialInstanceDynamic* Paint(UObject* Outer, const FLinearColor& Color, float Roughness = 0.7f);
	UMaterialInstanceDynamic* Glow(UObject* Outer, const FLinearColor& Color, float Opacity = 0.45f);
	int32 MissingAssets();

	// Spawns all parts of a Blender asset (e.g. "rover") under Parent. Returns part name ("wFL", "head"...) -> component.
	TMap<FString, UStaticMeshComponent*> AddModel(AActor* Owner, USceneComponent* Parent, const FString& Asset, bool bCollide);
	// A plain engine shape with a colour (sizes in metres)
	UStaticMeshComponent* AddShape(AActor* Owner, USceneComponent* Parent, const TCHAR* Shape, const FVector& LocCm, const FVector& SizeM, const FRotator& Rot, UMaterialInterface* Mat, bool bCollide);

	// Simple 4-limb animation used by the player, the crew and the driver
	void AnimatePerson(const TMap<FString, UStaticMeshComponent*>& Parts, double Phase, double Amp, bool bWork);
}
