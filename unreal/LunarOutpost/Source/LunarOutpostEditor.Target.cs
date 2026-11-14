using UnrealBuildTool;
using System.Collections.Generic;

public class LunarOutpostEditorTarget : TargetRules
{
	public LunarOutpostEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("LunarOutpost");
	}
}
