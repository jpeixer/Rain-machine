using UnityEngine;

/// <summary>
/// Metadados de uma peça clicável exportados para o viewer web (BOM).
/// Anexe no GameObject raiz de cada peça (mesh ou grupo).
/// </summary>
[DisallowMultipleComponent]
public class PartInfo : MonoBehaviour
{
    [Tooltip("ID único da peça (ex: RM-P-001)")]
    public string partId = "";

    [Tooltip("Nome exibido no painel BOM")]
    public string displayName = "";

    [TextArea(2, 6)]
    public string description = "";

    [Min(1)]
    public int quantity = 1;

    [Tooltip("Categoria para agrupamento (estrutura, fluidos, elétrica…)")]
    public string category = "estrutura";

    [Tooltip("Rótulo da animação associada (opcional, só documentação)")]
    public string animationLabel = "";

    public string NodeName => gameObject.name;

    void Reset()
    {
        if (string.IsNullOrEmpty(displayName))
            displayName = gameObject.name;
    }

    void OnValidate()
    {
        if (string.IsNullOrEmpty(displayName))
            displayName = gameObject.name;
    }
}
