# Image Generator MCP Server

A Model Context Protocol (MCP) server that generates test images with customizable width, height, and color. Saves images as PNG files to specified file paths.

## Features

- Generate test images with specified dimensions (1-4096 pixels)
- Support for hex color format (e.g., #FF0000, #f00)
- Automatic text overlay showing image dimensions
- Optional custom label text displayed in the top-left corner
- Smart contrast color selection for readable text
- Saves images as PNG files to specified file paths
- Automatically creates directories if they don't exist

## Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```
3. Build the server:
```bash
npm run build
```
4. Add the server to your MCP configuration:

For VSCode:
```json
{
    "servers": {
        "Image Placeholder Gen": {
            "type": "stdio",
            "command": "node",
            "args": [
                "~/mcp_servers/image-gen/build/index.js"
            ]
        }
    }
}
```

For Claude Desktop:
```json
{
  "mcpServers": {
    "image-gen": {
      "command": "node",
      "args": ["/path/to/image-gen/build/index.js"]
    }
  }
}
```

## Usage

The server provides one tool:

### generate_test_image

Generate a test image with specified parameters.

**Parameters:**
- `width` (number): Width of the image in pixels (1-4096)
- `height` (number): Height of the image in pixels (1-4096)  
- `color` (string): Color of the image as hex code (e.g., #FF0000 or #f00)
- `filepath` (string): Full path where the PNG image should be saved
- `label` (string, optional): Custom text to display in the top-left corner of the image

**Example:**
```json
{
  "name": "generate_test_image",
  "arguments": {
    "width": 400,
    "height": 300,
    "color": "#3498db",
    "filepath": "/tmp/test_image.png",
    "label": "My Custom Label"
  }
}
```

**Returns:**
- Text confirmation that the image was successfully generated and saved

## Color Format

The tool supports hex color format:
- **Hex colors**: `#FF0000`, `#f00`

## Testing

Run the test script to verify the server works:

```bash
npm run build
npm test
```

## Dependencies

- Node.js canvas library for image generation
- Model Context Protocol SDK

## Notes

- Maximum image dimensions are capped at 4096x4096 pixels for performance
- Generated images include dimension text overlay for easy identification
- Text color is automatically chosen for optimal contrast against the background
- The server automatically creates directories if they don't exist in the specified file path

## Contributing

Feel free to submit issues and enhancement requests!
