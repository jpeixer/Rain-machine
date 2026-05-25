using UnityEngine;

/// <summary>
/// Marca o GameObject raiz exportado para a web. O menu de export usa este componente
/// ou busca um objeto chamado "RainMachine".
/// </summary>
[DisallowMultipleComponent]
public class RainMachineRoot : MonoBehaviour
{
    [Tooltip("Nome exibido no viewer e no JSON")]
    public string modelTitle = "Rain Machine";
}
