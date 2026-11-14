// Numbers the mission uses. Same NASA anchors as the web game.
#pragma once

#include "CoreMinimal.h"

namespace OutpostRules
{
	constexpr int32 CREW = 4;
	constexpr double O2_PER = 0.84;          // kg O2 per person per day, NASA BVAD
	constexpr double FOOD_PER = 1.8;         // kg food per person per day incl. packaging, NASA BVAD
	constexpr double WATER_GROSS = 10;       // L per person per day (simplified)
	constexpr double RECOVERY = 0.90;        // water recycled, ISS ECLSS ~93-98%
	constexpr double O2_SYS_KWH = 20, O2_SYS_KG = 3.6, O2_WATER_PER_KG = 1.125; // electrolysis: 9 g water -> 8 g O2
	constexpr double WATER_SYS_KWH = 8;
	constexpr double GH_KWH = 12, GH_FOOD = 1.6, GH_O2 = 0.4;
	constexpr double O2_CAP = 60, BAT_ADD = 60;
	constexpr double DOSE_LIMIT = 100;       // game mission limit, mSv
	constexpr double SHIELD[5] = { 1, 0.7, 0.45, 0.3, 0.2 }; // dose multiplier per regolith layer
	constexpr int32 SCIENCE_GOAL = 6;

	// one real solar event from Data/FlareData.inl
	struct FFlare { const TCHAR* Date; const TCHAR* Cls; int32 S; double Dose; const TCHAR* Src; const TCHAR* NoteRu; const TCHAR* NoteEn; };
	int32 NumFlares();
	const FFlare& Flare(int32 Index);
}
