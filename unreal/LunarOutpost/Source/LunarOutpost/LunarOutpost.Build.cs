using System.IO;
using UnrealBuildTool;

public class LunarOutpost : ModuleRules
{
	public LunarOutpost(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "ProceduralMeshComponent", "PhysicsCore" });

		// code is split into folders; each folder is an include path so files include each other by name
		foreach (string Dir in new string[] { "Core", "World", "Player", "Rover", "Crew", "Game", "UI", "Data" })
			PublicIncludePaths.Add(Path.Combine(ModuleDirectory, Dir));
	}
}
