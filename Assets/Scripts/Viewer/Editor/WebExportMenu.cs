using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using GLTFast.Export;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Exporta RainMachine para docs/ (GLB + JSON) para GitHub Pages.
/// Menu: Rain Machine → Export for Web
/// </summary>
public static class WebExportMenu
{
    const string RootName = "RainMachine";
    const string DocsFolder = "docs";
    const string GlbPath = "docs/assets/machine.glb";
    const string PartsPath = "docs/data/parts.json";
    const string ConfigPath = "docs/data/viewer-config.json";

    [MenuItem("Rain Machine/Export for Web")]
    public static void ExportForWebMenu()
    {
        _ = ExportForWebAsync();
    }

    static async Task ExportForWebAsync()
    {
        var root = FindExportRoot();
        if (root == null)
        {
            EditorUtility.DisplayDialog(
                "Rain Machine",
                $"Nenhum objeto '{RootName}' ou com RainMachineRoot na cena.\n\n" +
                "Use Rain Machine → Setup Demo Scene primeiro.",
                "OK");
            return;
        }

        EnsureDirectories();

        try
        {
            EditorUtility.DisplayProgressBar("Rain Machine", "Exportando GLB…", 0.2f);
            await ExportGlbAsync(root);

            EditorUtility.DisplayProgressBar("Rain Machine", "Gerando parts.json…", 0.6f);
            WritePartsJson(root);

            EditorUtility.DisplayProgressBar("Rain Machine", "Gerando viewer-config.json…", 0.85f);
            WriteViewerConfig();

            AssetDatabase.Refresh();
            Debug.Log($"[Rain Machine] Export concluído:\n  {GlbPath}\n  {PartsPath}\n  {ConfigPath}");
            EditorUtility.DisplayDialog("Rain Machine", "Export para web concluído com sucesso.", "OK");
        }
        catch (Exception ex)
        {
            Debug.LogError($"[Rain Machine] Export falhou: {ex}");
            EditorUtility.DisplayDialog("Rain Machine", $"Export falhou:\n{ex.Message}", "OK");
        }
        finally
        {
            EditorUtility.ClearProgressBar();
        }
    }

    static GameObject FindExportRoot()
    {
        var tagged = UnityEngine.Object.FindFirstObjectByType<RainMachineRoot>();
        if (tagged != null) return tagged.gameObject;
        return GameObject.Find(RootName);
    }

    static void EnsureDirectories()
    {
        Directory.CreateDirectory(Path.Combine(DocsFolder, "assets"));
        Directory.CreateDirectory(Path.Combine(DocsFolder, "data"));
    }

    static async Task ExportGlbAsync(GameObject root)
    {
        var fullPath = Path.GetFullPath(GlbPath);
        var exportSettings = new ExportSettings
        {
            Format = GltfFormat.Binary,
            FileConflictResolution = FileConflictResolution.Overwrite,
        };

        var export = new GameObjectExport(exportSettings);
        if (!export.AddScene(new[] { root }, root.name))
            throw new InvalidOperationException("Falha ao adicionar cena ao export GLB.");

        var success = await export.SaveToFileAndDispose(fullPath);
        if (!success)
            throw new InvalidOperationException("SaveToFileAndDispose retornou false.");
    }

    static void WritePartsJson(GameObject root)
    {
        var rootMeta = root.GetComponent<RainMachineRoot>();
        var modelTitle = rootMeta != null ? rootMeta.modelTitle : "Rain Machine";

        var parts = root.GetComponentsInChildren<PartInfo>(true);
        var animLabels = CollectAnimationLabels(root);

        var sb = new StringBuilder();
        sb.AppendLine("{");
        sb.AppendLine("  \"version\": 1,");
        sb.AppendLine($"  \"model\": {JsonStr(modelTitle)},");
        sb.AppendLine("  \"parts\": [");

        for (var i = 0; i < parts.Length; i++)
        {
            var p = parts[i];
            sb.AppendLine("    {");
            sb.AppendLine($"      \"partId\": {JsonStr(p.partId)},");
            sb.AppendLine($"      \"nodeName\": {JsonStr(p.NodeName)},");
            sb.AppendLine($"      \"displayName\": {JsonStr(p.displayName)},");
            sb.AppendLine($"      \"description\": {JsonStr(p.description)},");
            sb.AppendLine($"      \"quantity\": {Mathf.Max(1, p.quantity)},");
            sb.AppendLine($"      \"category\": {JsonStr(p.category)}");
            sb.Append("    }");
            sb.AppendLine(i < parts.Length - 1 ? "," : "");
        }

        sb.AppendLine("  ],");
        sb.AppendLine("  \"animations\": [");

        for (var i = 0; i < animLabels.Count; i++)
        {
            var a = animLabels[i];
            sb.AppendLine("    {");
            sb.AppendLine($"      \"clipName\": {JsonStr(a.clipName)},");
            sb.AppendLine($"      \"label\": {JsonStr(a.label)}");
            sb.Append("    }");
            sb.AppendLine(i < animLabels.Count - 1 ? "," : "");
        }

        sb.AppendLine("  ]");
        sb.AppendLine("}");

        File.WriteAllText(PartsPath, sb.ToString(), Encoding.UTF8);
        ValidatePartNodes(parts);
    }

    static List<(string clipName, string label)> CollectAnimationLabels(GameObject root)
    {
        var result = new List<(string, string)>();
        var animator = root.GetComponentInChildren<Animator>();
        if (animator == null || animator.runtimeAnimatorController == null)
            return result;

        foreach (var clip in animator.runtimeAnimatorController.animationClips)
        {
            if (clip == null) continue;
            result.Add((clip.name, HumanizeClipName(clip.name)));
        }

        return result;
    }

    static string HumanizeClipName(string clipName)
    {
        if (clipName == "OpenValve") return "Abrir válvula";
        if (clipName == "CycleRain") return "Ciclo chuva";
        return clipName.Replace('_', ' ');
    }

    static void ValidatePartNodes(PartInfo[] parts)
    {
        foreach (var p in parts)
        {
            if (string.IsNullOrWhiteSpace(p.partId))
                Debug.LogWarning($"[Rain Machine] PartInfo sem partId em '{p.NodeName}'");
        }
    }

    static void WriteViewerConfig()
    {
        const string json = @"{
  ""version"": 1,
  ""modelPath"": ""./assets/machine.glb"",
  ""backgroundColor"": ""#0f1419"",
  ""camera"": {
    ""fov"": 45,
    ""minDistance"": 0.8,
    ""maxDistance"": 12,
    ""target"": [0, 0.6, 0]
  },
  ""lights"": {
    ""ambientIntensity"": 0.55,
    ""directionalIntensity"": 1.1,
    ""directionalPosition"": [4, 8, 6]
  },
  ""highlight"": {
    ""emissiveColor"": ""#3d9be9"",
    ""emissiveIntensity"": 0.35
  },
  ""fallbackDemo"": true
}
";
        File.WriteAllText(ConfigPath, json, Encoding.UTF8);
    }

    static string JsonStr(string value)
    {
        if (string.IsNullOrEmpty(value)) return "\"\"";
        return "\"" + value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "") + "\"";
    }
}
