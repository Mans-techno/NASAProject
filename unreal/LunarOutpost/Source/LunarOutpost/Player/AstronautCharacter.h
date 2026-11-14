// The player: walks in first person (V switches to third person), Moon or Mars gravity outside,
// Earth-like gravity inside the base (a simplification, as in the web game). E uses things, L switches language.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AstronautCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class AOutpostWorld;

enum class EUseTarget : uint8 { None, Rover, Npc, Station };

UCLASS()
class LUNAROUTPOST_API AAstronautCharacter : public ACharacter
{
	GENERATED_BODY()
public:
	AAstronautCharacter();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void PossessedBy(AController* NewController) override;

	bool IsIndoor() const { return bIndoor; }
	// What E would do right now, for the HUD prompt ("" when nothing is near)
	FString Prompt() const { return PromptText; }

private:
	UPROPERTY() TObjectPtr<USceneComponent> BodyRoot = nullptr;
	UPROPERTY() TObjectPtr<UCameraComponent> EyeCam = nullptr;
	UPROPERTY() TObjectPtr<USpringArmComponent> Arm = nullptr;
	UPROPERTY() TObjectPtr<UCameraComponent> TpCam = nullptr;
	TMap<FString, UStaticMeshComponent*> Parts;

	bool bIndoor = true, bFirstPerson = true, bJumpTold = false;
	double Phase = 0, PossessedAt = 0;
	FString PromptText;
	EUseTarget Target = EUseTarget::None;
	FString TargetId;
	int32 TargetNpc = -1;

	AOutpostWorld* World() const;
	void SetFirstPerson(bool bFp);
	void FindTarget();
	void Use();
};
