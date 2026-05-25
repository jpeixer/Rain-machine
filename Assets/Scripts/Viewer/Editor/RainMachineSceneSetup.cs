using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Cria hierarquia demo RainMachine com PartInfo e animação de exemplo.
/// Menu: Rain Machine → Setup Demo Scene
/// </summary>
public static class RainMachineSceneSetup
{
    const string RootName = "RainMachine";

    [MenuItem("Rain Machine/Setup Demo Scene")]
    public static void SetupDemoScene()
    {
        var existing = GameObject.Find(RootName);
        if (existing != null)
        {
            if (!EditorUtility.DisplayDialog(
                    "Rain Machine",
                    $"Já existe um objeto '{RootName}'. Substituir?",
                    "Substituir",
                    "Cancelar"))
                return;
            Object.DestroyImmediate(existing);
        }

        var root = new GameObject(RootName);
        root.AddComponent<RainMachineRoot>();

        var structure = new GameObject("Structure");
        structure.transform.SetParent(root.transform, false);

        var mechanisms = new GameObject("Mechanisms");
        mechanisms.transform.SetParent(root.transform, false);

        var hotspots = new GameObject("Hotspots");
        hotspots.transform.SetParent(root.transform, false);

        CreatePart(structure.transform, "BasePlate", new Vector3(0f, 0.075f, 0f),
            PrimitiveType.Cube, new Vector3(2f, 0.15f, 1.2f),
            new Color(0.29f, 0.33f, 0.41f), "RM-P-001", "Chassi base",
            "Placa estrutural inferior que sustenta os módulos da máquina.", "estrutura");

        CreatePart(mechanisms.transform, "PumpBody", new Vector3(0f, 0.4f, 0f),
            PrimitiveType.Cylinder, new Vector3(0.5f, 0.5f, 0.5f),
            new Color(0.17f, 0.42f, 0.69f), "RM-P-002", "Corpo da bomba",
            "Conjunto de bombeamento responsável pela pressão do fluido.", "fluidos");

        var nozzle = CreatePart(mechanisms.transform, "Nozzle_A", new Vector3(0.6f, 0.55f, 0f),
            PrimitiveType.Capsule, new Vector3(0.2f, 0.35f, 0.2f),
            new Color(0.22f, 0.63f, 0.41f), "RM-P-003", "Bico de saída A",
            "Bico direcionável para distribuição do fluxo.", "fluidos", quantity: 2);
        nozzle.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);

        CreatePart(structure.transform, "ControlPanel", new Vector3(-0.7f, 0.5f, 0.35f),
            PrimitiveType.Cube, new Vector3(0.5f, 0.35f, 0.08f),
            new Color(0.5f, 0.35f, 0.84f), "RM-P-004", "Painel de controle",
            "Interface de operação e indicadores do sistema.", "elétrica");

        CreateHotspot(hotspots.transform, "Hotspot_Pump", new Vector3(0f, 0.45f, 0f), 0.35f);

        var animator = root.AddComponent<Animator>();
        var controller = CreateDemoAnimatorController(nozzle.transform, root.transform);
        animator.runtimeAnimatorController = controller;

        Selection.activeGameObject = root;
        EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        Debug.Log("[Rain Machine] Cena demo criada. Use Rain Machine → Export for Web quando pronto.");
    }

    static GameObject CreatePart(Transform parent, string name, Vector3 localPos,
        PrimitiveType primitive, Vector3 scale, Color color,
        string partId, string displayName, string description, string category, int quantity = 1)
    {
        var go = GameObject.CreatePrimitive(primitive);
        go.name = name;
        go.transform.SetParent(parent, false);
        go.transform.localPosition = localPos;
        go.transform.localScale = scale;

        var renderer = go.GetComponent<Renderer>();
        if (renderer != null)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            mat.color = color;
            renderer.sharedMaterial = mat;
        }

        var info = go.AddComponent<PartInfo>();
        info.partId = partId;
        info.displayName = displayName;
        info.description = description;
        info.category = category;
        info.quantity = quantity;

        return go;
    }

    static void CreateHotspot(Transform parent, string name, Vector3 localPos, float radius)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        go.name = name;
        go.transform.SetParent(parent, false);
        go.transform.localPosition = localPos;
        go.transform.localScale = Vector3.one * radius * 2f;
        var col = go.GetComponent<Collider>();
        if (col != null) Object.DestroyImmediate(col);
        var renderer = go.GetComponent<Renderer>();
        if (renderer != null)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            mat.color = new Color(1f, 1f, 0f, 0.15f);
            renderer.sharedMaterial = mat;
        }
        go.hideFlags = HideFlags.None;
    }

    static RuntimeAnimatorController CreateDemoAnimatorController(Transform nozzle, Transform root)
    {
        const string controllerPath = "Assets/Scripts/Viewer/DemoRainMachine.controller";
        const string openValvePath = "Assets/Scripts/Viewer/Animations/OpenValve.anim";
        const string cycleRainPath = "Assets/Scripts/Viewer/Animations/CycleRain.anim";

        EnsureFolder("Assets/Scripts/Viewer/Animations");

        var openClip = CreateRotationClip("OpenValve", nozzle, root, 0f, 45f, 1.2f);
        var cycleClip = CreateFloatClip("CycleRain", 1.5f);

        AssetDatabase.CreateAsset(openClip, openValvePath);
        AssetDatabase.CreateAsset(cycleClip, cycleRainPath);

        var controller = AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
        controller.AddParameter("Cycle", AnimatorControllerParameterType.Float);

        var openState = controller.layers[0].stateMachine.AddState("OpenValve");
        openState.motion = openClip;
        var cycleState = controller.layers[0].stateMachine.AddState("CycleRain");
        cycleState.motion = cycleClip;

        controller.layers[0].stateMachine.defaultState = openState;

        AssetDatabase.SaveAssets();
        return controller;
    }

    static AnimationClip CreateRotationClip(string name, Transform target, Transform root,
        float fromDeg, float toDeg, float duration)
    {
        var clip = new AnimationClip { name = name };
        clip.frameRate = 30f;
        var curve = AnimationCurve.EaseInOut(0f, fromDeg, duration, toDeg);
        var binding = EditorCurveBinding.FloatCurve(
            AnimationUtility.CalculateTransformPath(target, root),
            typeof(Transform),
            "localEulerAngles.z");
        AnimationUtility.SetEditorCurve(clip, binding, curve);
        return clip;
    }

    static AnimationClip CreateFloatClip(string name, float duration)
    {
        var clip = new AnimationClip { name = name };
        clip.frameRate = 30f;
        var curve = AnimationCurve.Linear(0f, 0f, duration, 1f);
        clip.SetCurve("", typeof(Animator), "Cycle", curve);
        return clip;
    }

    static void EnsureFolder(string path)
    {
        if (AssetDatabase.IsValidFolder(path)) return;
        var parts = path.Split('/');
        var current = parts[0];
        for (var i = 1; i < parts.Length; i++)
        {
            var next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
                AssetDatabase.CreateFolder(current, parts[i]);
            current = next;
        }
    }
}
