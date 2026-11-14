// On-screen panel drawn with Canvas (no UMG assets needed): base resources, suit oxygen, the E prompt,
// station panels with today's task choices, messages and the end-of-mission screen. Roboto has Cyrillic.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "OutpostHUD.generated.h"

class UFont;

UCLASS()
class LUNAROUTPOST_API AOutpostHUD : public AHUD
{
	GENERATED_BODY()
public:
	virtual void DrawHUD() override;

private:
	UPROPERTY() TObjectPtr<UFont> Font = nullptr;
	float Scale = 1.f;

	void Text(const FString& S, float X, float Y, const FLinearColor& C, float Size = 1.f);
	float Wrapped(const FString& S, float X, float Y, float W, const FLinearColor& C, float Size = 1.f, bool bDraw = true); // returns height used
	void Bar(const FString& Label, double V, double Max, const FString& Val, float X, float Y, const FLinearColor& C);
};
