using UnrealBuildTool;

public class LunarOutpost : ModuleRules
{
	public LunarOutpost(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "ProceduralMeshComponent", "PhysicsCore" });
	}
}
