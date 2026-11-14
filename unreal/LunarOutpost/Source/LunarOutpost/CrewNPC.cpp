#include "CrewNPC.h"
#include "OutpostWorld.h"
#include "OutpostCommon.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

using namespace Outpost;

namespace
{
	struct FSpot { double Fx, Fz; bool bWork, bRun, bHasFace; };

	const TMap<FString, FVector2D>& Nav()
	{
		static const TMap<FString, FVector2D> M = {
			{TEXT("hub"), {1.5,-2}}, {TEXT("E"), {9.6,0}}, {TEXT("W"), {-9.6,0}}, {TEXT("S"), {0,-9.6}}, {TEXT("N1"), {6,0.5}},
			{TEXT("gal"), {6.62,5.17}}, {TEXT("tab"), {4.4,3.7}}, {TEXT("bunk"), {-1.11,6.3}}, {TEXT("desk"), {-5.0,-4.5}},
			{TEXT("med"), {5.2,-3.4}}, {TEXT("tread"), {-7.52,4.17}}, {TEXT("gym"), {-5.2,2.6}},
			{TEXT("cE"), {17,0}}, {TEXT("suits"), {15.8,0.5}}, {TEXT("cW"), {-17,0}}, {TEXT("ghE"), {-26.5,0}},
			{TEXT("gh1"), {-30.6,0.1}}, {TEXT("gh2"), {-36.2,-0.1}}, {TEXT("cS"), {0,-16}}, {TEXT("labE"), {0,-21.8}},
			{TEXT("lab1"), {-4,-24.5}}, {TEXT("lab2"), {2.0,-24.6}} };
		return M;
	}

	const TMap<FString, TArray<FString>>& Adj()
	{
		static TMap<FString, TArray<FString>> M;
		if (M.Num() == 0)
		{
			const TCHAR* E[][2] = { {TEXT("hub"),TEXT("E")},{TEXT("hub"),TEXT("W")},{TEXT("hub"),TEXT("S")},{TEXT("hub"),TEXT("N1")},{TEXT("N1"),TEXT("gal")},
				{TEXT("hub"),TEXT("tab")},{TEXT("tab"),TEXT("bunk")},{TEXT("tab"),TEXT("gym")},{TEXT("gym"),TEXT("tread")},{TEXT("hub"),TEXT("gym")},
				{TEXT("hub"),TEXT("desk")},{TEXT("hub"),TEXT("med")},{TEXT("E"),TEXT("cE")},{TEXT("cE"),TEXT("suits")},{TEXT("W"),TEXT("cW")},
				{TEXT("cW"),TEXT("ghE")},{TEXT("ghE"),TEXT("gh1")},{TEXT("gh1"),TEXT("gh2")},{TEXT("S"),TEXT("cS")},{TEXT("cS"),TEXT("labE")},
				{TEXT("labE"),TEXT("lab1")},{TEXT("labE"),TEXT("lab2")} };
			for (const auto& P : E) { M.FindOrAdd(P[0]).Add(P[1]); M.FindOrAdd(P[1]).Add(P[0]); }
		}
		return M;
	}

	FSpot SpotOf(const FString& N)
	{
		static const TMap<FString, FSpot> M = {
			{TEXT("gal"), {7.37,5.76,true,false,true}}, {TEXT("tab"), {5.43,4.72,false,false,true}}, {TEXT("bunk"), {-1.4,8.0,false,false,true}},
			{TEXT("gym"), {-9.18,4.09,false,false,true}}, {TEXT("desk"), {-6.50,-5.85,true,false,true}}, {TEXT("med"), {6.17,-5.55,true,false,true}},
			{TEXT("tread"), {-6.6,3.66,false,true,true}}, {TEXT("suits"), {15.8,2,false,false,true}}, {TEXT("gh1"), {-30.6,1.8,true,false,true}},
			{TEXT("gh2"), {-36.2,-1.8,true,false,true}}, {TEXT("lab1"), {-4,-26,true,false,true}}, {TEXT("lab2"), {2.0,-26,true,false,true}} };
		const FSpot* S = M.Find(N);
		return S ? *S : FSpot{ 0,0,false,false,false };
	}

	TArray<FString> Route(const FString& A, const FString& B)
	{
		TMap<FString, FString> Prev; Prev.Add(A, FString());
		TArray<FString> Q = { A };
		for (int32 I = 0; I < Q.Num(); ++I)
		{
			if (Q[I] == B) break;
			if (const TArray<FString>* Next = Adj().Find(Q[I]))
				for (const FString& M : *Next) if (!Prev.Contains(M)) { Prev.Add(M, Q[I]); Q.Add(M); }
		}
		TArray<FString> Out;
		for (FString N = B; !N.IsEmpty(); N = Prev.FindRef(N)) Out.Insert(N, 0);
		return Out;
	}

	double Wrap(double A) { while (A > PI) A -= 2 * PI; while (A < -PI) A += 2 * PI; return A; }
}

ACrewNPC::ACrewNPC()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	BodyRoot = CreateDefaultSubobject<USceneComponent>(TEXT("BodyRoot"));
	BodyRoot->SetupAttachment(RootComponent);
}

void ACrewNPC::Setup(AOutpostWorld* InWorld, int32 K, const FLinearColor& Tint)
{
	OutpostWorld = InWorld; Index = K;
	static const TCHAR* Starts[3] = { TEXT("gal"), TEXT("med"), TEXT("gh1") };
	static const TArray<FString> Plans[3] = {
		{TEXT("gal"),TEXT("tab"),TEXT("desk"),TEXT("tread"),TEXT("bunk"),TEXT("suits")},
		{TEXT("med"),TEXT("tab"),TEXT("lab1"),TEXT("lab2"),TEXT("desk"),TEXT("tread")},
		{TEXT("gh1"),TEXT("gh2"),TEXT("gal"),TEXT("lab2"),TEXT("tab")} };
	Node = Starts[K % 3]; Spots = Plans[K % 3];
	X = Nav()[Node].X; Z = Nav()[Node].Y;
	Wait = 3 + K * 2; Phase = K;

	Parts = AddModel(this, BodyRoot, TEXT("crew"), false);
	// tint the suit fabric, like the web game does for the "fabric_blue" material
	UMaterialInstanceDynamic* Suit = Paint(this, Tint, 0.85f);
	for (auto& P : Parts)
	{
		const TArray<FName> Slots = P.Value->GetMaterialSlotNames();
		for (int32 I = 0; I < Slots.Num(); ++I)
			if (Slots[I].ToString().Contains(TEXT("fabric_blue"))) P.Value->SetMaterial(I, Suit);
	}
	SetActorLocation(U(X, Z, FloorAt(X, Z)));
}

double ACrewNPC::FloorAt(double Wx, double Wz) const
{
	FHitResult Hit;
	FCollisionQueryParams Q(TEXT("CrewFloor"), true, this);
	if (GetWorld()->LineTraceSingleByObjectType(Hit, U(Wx, Wz, 1.5), U(Wx, Wz, -2.0), FCollisionObjectQueryParams(ECC_WorldStatic), Q)) return Hit.ImpactPoint.Z / 100.0;
	return 0.3;
}

void ACrewNPC::Turn(double Want, double Rate, double Dt)
{
	Ry += Wrap(Want - Ry) * FMath::Min(1.0, Dt * Rate);
}

FString ACrewNPC::DisplayName() const
{
	switch (Index)
	{
	case 0: return Tr(TEXT("Аня, бортинженер"), TEXT("Anya, flight engineer"));
	case 1: return Tr(TEXT("Тимур, врач экипажа"), TEXT("Timur, crew doctor"));
	default: return Tr(TEXT("Лина, биолог"), TEXT("Lina, biologist"));
	}
}

FString ACrewNPC::Talk() const
{
	switch (Index)
	{
	case 0: return Tr(TEXT("Я слежу за энергией и шлюзом. Если начнётся солнечная буря, прячемся под реголитом!"), TEXT("I look after power and the airlock. If a solar storm starts, we hide under the regolith!"));
	case 1: return Tr(TEXT("Я считаю дозу радиации каждого из нас. Тренажёры нужны, чтобы кости и мышцы не слабели."), TEXT("I track everyone's radiation dose. The gym keeps our bones and muscles strong."));
	default: return Tr(TEXT("В теплице растут салат, томаты и пшеница. Им нужен свет фитоламп и вода."), TEXT("Lettuce, tomatoes and wheat grow in the greenhouse. They need grow lights and water."));
	}
}

void ACrewNPC::Tick(float Dt)
{
	Super::Tick(Dt);
	Dt = FMath::Min(Dt, 0.05f);
	if (Parts.Num() == 0) return;
	const FSpot Here = SpotOf(Node);
	if (Path.Num())
	{
		const FVector2D T = Nav()[Path[0]];
		const double Dx = T.X - X, Dz = T.Y - Z, D = FMath::Sqrt(Dx * Dx + Dz * Dz);
		if (D < 0.15) { Node = Path[0]; Path.RemoveAt(0); if (!Path.Num()) Wait = 7 + FMath::FRand() * 9; }
		else
		{
			const double Sp = FMath::Min(D, 1.25 * Dt);
			X += Dx / D * Sp; Z += Dz / D * Sp;
			Turn(FMath::Atan2(Dx, Dz), 8, Dt);
			Phase += Dt * 7; AnimatePerson(Parts, Phase, 0.55, false);
		}
	}
	else
	{
		Wait -= Dt; Phase += Dt * (Here.bRun ? 9 : 2.2);
		if (Here.bHasFace) Turn(FMath::Atan2(Here.Fx - X, Here.Fz - Z), 4, Dt);
		AnimatePerson(Parts, Phase, Here.bRun ? 0.6 : 0.05, Here.bWork);
		// stop and look at the commander when they come close
		if (APawn* Pl = UGameplayStatics::GetPlayerPawn(this, 0))
		{
			const double Px = Pl->GetActorLocation().X / 100.0, Pz = Pl->GetActorLocation().Y / 100.0;
			if (FMath::Sqrt((Px - X) * (Px - X) + (Pz - Z) * (Pz - Z)) < 2.4)
			{
				Turn(FMath::Atan2(Px - X, Pz - Z), 5, Dt);
				Wait = FMath::Max(Wait, 1.5);
				AnimatePerson(Parts, Phase, 0.02, false);
			}
		}
		if (Wait <= 0)
		{
			TArray<FString> Opts = Spots.FilterByPredicate([&](const FString& S) { return S != Node; });
			if (Opts.Num()) { Path = Route(Node, Opts[FMath::RandRange(0, Opts.Num() - 1)]); if (Path.Num()) Path.RemoveAt(0); }
		}
	}
	const double Floor = FloorAt(X, Z);
	const double Lift = (!Path.Num() && SpotOf(Node).bRun && Floor < 0.6) ? 0.42 : 0.0; // standing on the treadmill belt
	SetActorLocationAndRotation(U(X, Z, Floor + Lift), FRotator(0, Yaw(Ry), 0));
}
