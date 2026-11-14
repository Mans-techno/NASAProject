#include "OutpostHUD.h"
#include "OutpostGameMode.h"
#include "OutpostCommon.h"
#include "AstronautCharacter.h"
#include "RoverPawn.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"

using namespace Outpost;

static const FLinearColor PanelBg(0.01f, 0.015f, 0.03f, 0.72f);
static const FLinearColor TextC(0.92f, 0.95f, 1.0f);
static const FLinearColor Dim(0.6f, 0.68f, 0.8f);
static const FLinearColor Bad(1.0f, 0.3f, 0.3f);

void AOutpostHUD::Text(const FString& S, float X, float Y, const FLinearColor& C, float Size)
{
	FCanvasTextItem T(FVector2D(X, Y), FText::FromString(S), Font, C);
	T.Scale = FVector2D(Scale * Size, Scale * Size);
	T.EnableShadow(FLinearColor(0, 0, 0, 0.8f));
	Canvas->DrawItem(T);
}

float AOutpostHUD::Wrapped(const FString& S, float X, float Y, float W, const FLinearColor& C, float Size, bool bDraw)
{
	TArray<FString> Words; S.ParseIntoArray(Words, TEXT(" "));
	FString Line; float Yy = Y, Lw = 0, Lh = 0;
	for (const FString& Wd : Words)
	{
		const FString Try = Line.IsEmpty() ? Wd : Line + TEXT(" ") + Wd;
		float Tw = 0, Th = 0; GetTextSize(Try, Tw, Th, Font, Scale * Size);
		Lh = Th;
		if (Tw > W && !Line.IsEmpty()) { if (bDraw) Text(Line, X, Yy, C, Size); Yy += Lh * 1.15f; Line = Wd; }
		else Line = Try;
	}
	if (!Line.IsEmpty()) { if (bDraw) Text(Line, X, Yy, C, Size); Yy += Lh * 1.15f; }
	return Yy - Y;
}

void AOutpostHUD::Bar(const FString& Label, double V, double Max, const FString& Val, float X, float Y, const FLinearColor& C)
{
	const float W = 210 * Scale, H = 8 * Scale;
	Text(Label, X, Y, Dim, 0.9f);
	Text(Val, X + W - 70 * Scale, Y, TextC, 0.9f);
	const float By = Y + 20 * Scale;
	DrawRect(FLinearColor(1, 1, 1, 0.12f), X, By, W, H);
	DrawRect(C, X, By, W * FMath::Clamp((float)(V / FMath::Max(Max, 1e-3)), 0.f, 1.f), H);
}

void AOutpostHUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Font) Font = LoadObject<UFont>(nullptr, TEXT("/Engine/EngineFonts/Roboto.Roboto"));
	if (!Font) Font = GEngine->GetMediumFont();
	Scale = FMath::Clamp(Canvas->ClipY / 1080.f, 0.7f, 2.0f);
	AOutpostGameMode* GM = GetWorld()->GetAuthGameMode<AOutpostGameMode>();
	if (!GM) return;
	const FOutpostState& S = GM->S;

	// ---- left panel: the base
	const float X0 = 24 * Scale, W0 = 250 * Scale;
	float Y = 24 * Scale;
	DrawRect(PanelBg, X0 - 12 * Scale, Y - 12 * Scale, W0, 440 * Scale);
	Text(FString::Printf(TEXT("%s · %s %d/%d"), GM->PlanetName(), GM->bMars ? *Tr(TEXT("Сол"), TEXT("Sol")) : *Tr(TEXT("День"), TEXT("Day")), S.Day, S.Days), X0, Y, TextC, 1.15f);
	Y += 34 * Scale;
	if (GM->StormToday()) { Text(Tr(TEXT("Солнечная буря! Оставайся внутри."), TEXT("Solar storm! Stay inside.")), X0, Y, Bad); Y += 26 * Scale; }
	Bar(Tr(TEXT("Энергия, кВт·ч"), TEXT("Power, kWh")), S.Battery, S.BatCap, FString::Printf(TEXT("%.0f/%.0f"), S.Battery, S.BatCap), X0, Y, FLinearColor(1.f, 0.75f, 0.15f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Кислород, кг"), TEXT("Oxygen, kg")), S.O2, 60, FString::Printf(TEXT("%.1f"), S.O2), X0, Y, FLinearColor(0.35f, 0.75f, 1.f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Вода, л"), TEXT("Water, L")), S.Water, 200, FString::Printf(TEXT("%.0f"), S.Water), X0, Y, FLinearColor(0.3f, 0.55f, 1.f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Еда, кг"), TEXT("Food, kg")), S.Food, 120, FString::Printf(TEXT("%.0f"), S.Food), X0, Y, FLinearColor(0.45f, 0.85f, 0.35f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Здоровье"), TEXT("Health")), S.Health, 100, FString::Printf(TEXT("%.0f%%"), S.Health), X0, Y, S.Health < 40 ? Bad : FLinearColor(1.f, 0.45f, 0.55f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Доза, мЗв"), TEXT("Dose, mSv")), S.Dose, 100, FString::Printf(TEXT("%.1f/100"), S.Dose), X0, Y, FLinearColor(0.75f, 0.45f, 1.f)); Y += 38 * Scale;
	Bar(Tr(TEXT("Скафандр, O2"), TEXT("Suit O2")), S.SuitO2, 100, FString::Printf(TEXT("%.0f%%"), S.SuitO2), X0, Y, S.SuitO2 < 25 ? Bad : FLinearColor(0.35f, 0.9f, 0.9f)); Y += 42 * Scale;
	Text(FString::Printf(TEXT("%s %d/6 · %s %d · %s %d"), *Tr(TEXT("Наука"), TEXT("Science")), S.Science, *Tr(TEXT("пробы"), TEXT("samples")), S.Data,
		*Tr(TEXT("реголит"), TEXT("regolith")), S.Shield), X0, Y, TextC, 0.9f); Y += 24 * Scale;
	Text(FString::Printf(TEXT("%s %d · %s %d · %s %d"), *Tr(TEXT("Панели"), TEXT("Panels")), S.Panels, *Tr(TEXT("грядки"), TEXT("beds")), S.Greenhouses,
		*Tr(TEXT("запчасти"), TEXT("parts")), S.Parts), X0, Y, TextC, 0.9f); Y += 24 * Scale;
	Wrapped(FString::Printf(TEXT("%s: %s"), *Tr(TEXT("Задание дня"), TEXT("Today's task")), *GM->ActionName(S.Action)), X0, Y, W0 - 24 * Scale, Dim, 0.9f);

	// ---- bottom: what E does, and the controls
	APawn* P = GetOwningPawn();
	FString Prompt;
	if (const AAstronautCharacter* A = Cast<AAstronautCharacter>(P)) Prompt = A->Prompt();
	if (const ARoverPawn* R = Cast<ARoverPawn>(P))
		Prompt = FString::Printf(TEXT("%.1f %s · E — %s · V — %s"), R->Speed() * 3.6, *Tr(TEXT("км/ч"), TEXT("km/h")), *Tr(TEXT("выйти"), TEXT("get out")), *Tr(TEXT("вид"), TEXT("view")));
	if (!Prompt.IsEmpty())
	{
		float Tw = 0, Th = 0; GetTextSize(Prompt, Tw, Th, Font, Scale * 1.2f);
		const float Px = (Canvas->ClipX - Tw) / 2, Py = Canvas->ClipY - 120 * Scale;
		DrawRect(PanelBg, Px - 16 * Scale, Py - 8 * Scale, Tw + 32 * Scale, 44 * Scale);
		Text(Prompt, Px, Py, TextC, 1.2f);
	}
	Text(Tr(TEXT("WASD — идти · мышь — смотреть · Shift — бег · Пробел — прыжок · E — действие · V — вид · L — English · F2 — Луна/Марс"),
		TEXT("WASD walk · mouse look · Shift run · Space jump · E use · V view · L — Русский · F2 Moon/Mars")), 24 * Scale, Canvas->ClipY - 40 * Scale, Dim, 0.8f);

	// ---- messages, top right
	float Ty = 24 * Scale; const float Tw = 460 * Scale, Tx = Canvas->ClipX - Tw - 24 * Scale;
	for (const FToast& T : GM->Toasts)
	{
		const float H = Wrapped(T.Text, Tx, Ty, Tw, TextC, 0.95f, false); // measure first
		DrawRect(PanelBg, Tx - 12 * Scale, Ty - 8 * Scale, Tw + 24 * Scale, H + 16 * Scale);
		Wrapped(T.Text, Tx, Ty, Tw, TextC, 0.95f);
		Ty += H + 20 * Scale;
	}

	// ---- station panel, centre
	if (GM->IsPanelOpen() && GM->PanelLines.Num())
	{
		const float Pw = 640 * Scale, Px = (Canvas->ClipX - Pw) / 2; float Py = Canvas->ClipY * 0.28f;
		DrawRect(FLinearColor(0.01f, 0.02f, 0.05f, 0.88f), Px - 24 * Scale, Py - 20 * Scale, Pw + 48 * Scale, (90 + 34 * GM->PanelLines.Num()) * Scale + 80 * Scale);
		for (int32 I = 0; I < GM->PanelLines.Num(); ++I)
		{
			const bool bTitle = I == 0, bOption = GM->PanelLines[I].Len() > 2 && FChar::IsDigit(GM->PanelLines[I][0]);
			Py += Wrapped(GM->PanelLines[I], Px, Py, Pw, bTitle ? FLinearColor(0.55f, 0.75f, 1.f) : bOption ? FLinearColor(1.f, 0.85f, 0.4f) : TextC, bTitle ? 1.4f : 1.05f) + 10 * Scale;
		}
	}

	// ---- end of mission
	if (!S.Over.IsEmpty())
	{
		DrawRect(FLinearColor(0, 0, 0, 0.75f), 0, 0, Canvas->ClipX, Canvas->ClipY);
		FString Title, Why;
		if (S.Over == TEXT("win")) { Title = Tr(TEXT("Миссия выполнена!"), TEXT("Mission complete!")); Why = FString::Printf(TEXT("%s %d/6. %s %.1f %s."), *Tr(TEXT("Наука:"), TEXT("Science:")), S.Science, *Tr(TEXT("Доза экипажа:"), TEXT("Crew dose:")), S.Dose, *Tr(TEXT("мЗв"), TEXT("mSv"))); }
		else if (S.Over == TEXT("dose")) { Title = Tr(TEXT("Слишком большая доза радиации"), TEXT("Radiation dose too high")); Why = Tr(TEXT("Экипаж эвакуирован. Реголит над куполом защитил бы от протонных бурь."), TEXT("The crew was evacuated. Regolith over the dome would have shielded them from proton storms.")); }
		else if (S.Over == TEXT("o2")) { Title = Tr(TEXT("Закончился кислород"), TEXT("Out of oxygen")); Why = Tr(TEXT("Кислород делают из воды электролизом, а для этого нужна энергия."), TEXT("Oxygen is made from water by electrolysis, and that needs power.")); }
		else { Title = Tr(TEXT("Экипажу нужна помощь"), TEXT("The crew needs help")); Why = Tr(TEXT("Здоровье упало до нуля. Следи за едой, водой, энергией и отдыхом."), TEXT("Health fell to zero. Watch food, water, power and rest.")); }
		const float Cx = Canvas->ClipX * 0.25f, Cw = Canvas->ClipX * 0.5f;
		Text(Title, Cx, Canvas->ClipY * 0.38f, TextC, 2.0f);
		Wrapped(Why, Cx, Canvas->ClipY * 0.38f + 70 * Scale, Cw, Dim, 1.2f);
		Text(Tr(TEXT("Enter — начать заново"), TEXT("Enter — play again")), Cx, Canvas->ClipY * 0.38f + 170 * Scale, FLinearColor(1.f, 0.85f, 0.4f), 1.2f);
	}

	if (MissingAssets() > 0)
		Text(Tr(TEXT("Модели не импортированы: Tools → Execute Python Script → Scripts/import_models.py"), TEXT("Models not imported: Tools → Execute Python Script → Scripts/import_models.py")),
			24 * Scale, Canvas->ClipY - 70 * Scale, Bad, 0.9f);
}
