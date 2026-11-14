// Builds the whole outpost at runtime: the same terrain, the habitat with its rooms, tunnels, greenhouse and lab,
// the outdoor work sites, lights, stars, the Earth, the crew and the rover.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "OutpostCommon.h"
#include "OutpostWorld.generated.h"

namespace Outpost
{
	// greenhouse centre x and lab centre z in the web layout (metres)
	constexpr double GH_X = -33.4, LAB_Z = -24.0;
}

class UProceduralMeshComponent;
class UStaticMeshComponent;
class UPrimitiveComponent;
class ARoverPawn;
class ACrewNPC;

USTRUCT()
struct FStation
{
	GENERATED_BODY()
	FString Id;
	FVector Where = FVector::ZeroVector; // Unreal cm
	bool bIndoor = false;
	FLinearColor Color = FLinearColor::White;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Ring = nullptr;
};

UCLASS()
class LUNAROUTPOST_API AOutpostWorld : public AActor
{
	GENERATED_BODY()
public:
	AOutpostWorld();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	bool bMars = false;
	Outpost::FTerrain Terrain;

	UPROPERTY() TArray<FStation> Stations;
	UPROPERTY() TObjectPtr<ARoverPawn> Rover = nullptr;
	UPROPERTY() TArray<TObjectPtr<ACrewNPC>> Crew;

	// Ground height (cm) under an Unreal position, from the terrain function (no trace needed)
	double GroundZ(double XCm, double YCm) const { return Terrain.Height(XCm / 100.0, YCm / 100.0) * 100.0; }
	// True when (x,y) is inside a pressurised module (same zones as the web game)
	static bool InsideBase(const FVector& P);
	const FStation* NearestStation(const FVector& P, bool bIndoor, double& OutDist) const;
	void SetSolarActive(int32 Panels);
	void AddBermLayer(int32 Layers);
	UPrimitiveComponent* GetGround() const;

private:
	UPROPERTY() TObjectPtr<UProceduralMeshComponent> Ground = nullptr;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> DishHead = nullptr;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> SolarArrays;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Berm = nullptr;
	double Clock = 0;

	void BuildTerrain();
	void BuildBase();
	void BuildOutdoor();
	void BuildSky();
	void BuildStations();
	void Place(const FString& Asset, double X, double Zg, double Ry, bool bOnGround, double Y = 0.0, bool bCollide = true);
	void Sign(const FString& Key, const FVector& LocCm, double YawDeg, double WidthM, double HeightM, bool bPosts);
};
