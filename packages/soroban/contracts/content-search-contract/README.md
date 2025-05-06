# Contrato de Búsqueda de Contenido Educativo

Un contrato inteligente Soroban para buscar y gestionar contenido educativo basado en etiquetas de tema.

## Características

- Búsqueda de contenido educativo por etiquetas de tema
- Coincidencia parcial y case-insensitive de etiquetas
- Validación robusta de entrada y contenido
- Almacenamiento eficiente de metadatos de contenido
- Manejo de errores informativo

## Construcción del Contrato

Puedes construir el contrato de dos maneras:

Desde el directorio del contrato:
```bash
cd packages/soroban/contracts/content-search-contract
soroban contract build
```

Desde la raíz del proyecto:
```bash
soroban contract build --manifest-path ./packages/soroban/contracts/content-search-contract/Cargo.toml
```

## Pruebas

Para ejecutar las pruebas:

```bash
cargo test --features testutils
```

## Funciones del Contrato

### `search_content(subject: String) -> Vec<Content>`
Busca contenido educativo basado en etiquetas de tema.
- `subject`: La etiqueta o palabra clave a buscar
- Retorna: Lista de contenido que coincide con la búsqueda

### `add_content(title: String, description: String, subject_tags: Vec<String>, content_url: String) -> u64`
Agrega nuevo contenido educativo al sistema.
- `title`: Título del contenido
- `description`: Descripción del contenido
- `subject_tags`: Lista de etiquetas de tema
- `content_url`: URL del contenido
- Retorna: ID del contenido agregado

## Estructura de Datos

### Content
```rust
struct Content {
    id: u64,
    title: String,
    description: String,
    subject_tags: Vec<String>,
    content_url: String,
}
```

## Manejo de Errores

El contrato define varios tipos de error para manejar diferentes escenarios de fallo:

- `NoMatchingContent`: Cuando no se encuentra contenido que coincida con la búsqueda
- `InvalidInput`: Cuando la entrada proporcionada no es válida
  - Título vacío
  - Descripción vacía
  - URL vacía
  - Sin etiquetas de tema
  - Etiquetas inválidas

## Requisitos

- Rust 1.70.0 o superior
- Soroban CLI
- Stellar Development Environment

## Instalación

1. Instala Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Instala Soroban CLI:
```bash
cargo install soroban-cli
```

3. Clona el repositorio:
```bash
git clone https://github.com/akkuea/akkuea.git
cd akkuea
```

4. Construye el contrato:
```bash
soroban contract build --manifest-path ./packages/soroban/contracts/content-search-contract/Cargo.toml
```

## Ejemplo de Uso

```rust
// Agregar contenido
let content_id = contract.add_content(
    "Introducción a Blockchain",
    "Conceptos básicos de blockchain y criptomonedas",
    vec!["blockchain", "criptomonedas", "tecnología"],
    "https://ejemplo.com/blockchain"
);

// Buscar contenido
let results = contract.search_content("blockchain");
```

## Contribución

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles. 