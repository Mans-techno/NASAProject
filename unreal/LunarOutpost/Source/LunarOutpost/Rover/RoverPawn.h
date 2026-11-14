// The drivable rover. Same handling as the web game: W/S throttle, A/D steer, Shift faster, Space brake,
// slopes speed it up or slow it down, crests throw it into a low-gravity hop. E gets out.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "RoverPawn.generated.h"

class AOutpostWorld;
class ACharacter;
class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;

UCLASS()
class LUNAROUTPOST_API ARoverPawn : public APawn
{
	GENERATED_BODY()
public:
	ARoverPawn();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY() TObjectPtr<AOutpostWorld> OutpostWorld = nullptr;

	// Called by the astronaut when E is pressed next to the rover
	void Enter(ACharacter* Walker);
	bool IsDriven() const { return bDriven; }
	float Speed() const { return FMath::Abs(V); }

private:
	UPROPERTY() TObjectPtr<USceneComponent> Body = nullptr;
	UPROPERTY() TObjectPtr<USceneComponent> DriverRoot = nullptr;
	UPROPERTY() TObjectPtr<USpringArmComponent> Arm = nullptr;
	UPROPERTY() TObjectPtr<UCameraComponent> ChaseCam = nullptr;
	UPROPERTY() TObjectPtr<UCameraComponent> SeatCam = nullptr;
	UPROPERTY() TObjectPtr<ACharacter> Passenger = nullptr;
	TMap<FString, UStaticMeshComponent*> Parts;
	TMap<FString, UStaticMeshComponent*> Driver;

	bool bDriven = false, bFirstPerson = false;
	double V = 0, Steer = 0, Heading = 0;      // m/s, rad, Unreal yaw in rad
	double Y = 0, Vy = 0, PrevT = 0, Air = 0;  // vertical motion in metres
	double Spin = 0, Clock = 0, EnteredAt = 0;
	bool bHasY = false;

	void Pose(double XCm, double YCm, double H);
	bool Clear(double XCm, double YCm, double H) const;
	void Exit();
	void SetFirstPerson(bool bFp);
};
