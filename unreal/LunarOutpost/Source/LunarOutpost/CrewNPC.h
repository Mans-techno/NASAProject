// A crew member walking through the base along the same route graph as the web game:
// galley, table, bunks, comms desk, med bay, treadmill, gym, suits, greenhouse beds and lab benches.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CrewNPC.generated.h"

class AOutpostWorld;
class UStaticMeshComponent;

UCLASS()
class LUNAROUTPOST_API ACrewNPC : public AActor
{
	GENERATED_BODY()
public:
	ACrewNPC();
	virtual void Tick(float DeltaSeconds) override;

	void Setup(AOutpostWorld* InWorld, int32 K, const FLinearColor& Tint);
	FString DisplayName() const;  // "Аня, бортинженер"
	FString Talk() const;         // what they say when the commander walks up

private:
	UPROPERTY() TObjectPtr<AOutpostWorld> OutpostWorld = nullptr;
	UPROPERTY() TObjectPtr<USceneComponent> BodyRoot = nullptr;
	TMap<FString, UStaticMeshComponent*> Parts;

	int32 Index = 0;
	FString Node;
	TArray<FString> Path;
	TArray<FString> Spots;
	double X = 0, Z = 0;     // web-space metres
	double Ry = 0;           // web-space heading (three.js rotation.y)
	double Wait = 3, Phase = 0;

	double FloorAt(double Wx, double Wz) const;
	void Turn(double Want, double Rate, double Dt);
};
