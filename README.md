# Image Generator MCP Server

A Model Context Protocol (MCP) server that generates test images with customizable width, height, and color. Returns images as base64-encoded PNG data.

## Features

- Generate test images with specified dimensions (1-4096 pixels)
- Support for various color formats:
  - Hex colors (e.g., #FF0000, #f00)
  - CSS color names (e.g., red, blue, green)
  - RGB/RGBA format (e.g., rgb(255,0,0))
- Automatic text overlay showing image dimensions
- Smart contrast color selection for readable text
- Returns base64-encoded PNG data

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

For VSCode (Claude Dev Extension):
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
- `color` (string): Color of the image (hex, CSS color name, or rgb/rgba format)

**Example:**
```json
{
  "name": "generate_test_image",
  "arguments": {
    "width": 400,
    "height": 300,
    "color": "#3498db"
  }
}
```

**Returns:**
- Text description of the generated image
- Base64-encoded PNG image data (data URI format)

## Color Formats

The tool supports various color formats:

- **Hex colors**: `#FF0000`, `#f00`
- **CSS color names**: `red`, `blue`, `green`, `purple`, etc.
- **RGB format**: `rgb(255, 0, 0)`
- **RGBA format**: `rgba(255, 0, 0, 0.8)`

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

The server provides a single tool named `search` that accepts the following parameters:

```typescript
{
  "query": string,    // The search query
  "limit": number     // Optional: Number of results to return (default: 5, max: 10)
}
```

Example usage:
```typescript
use_mcp_tool({
  server_name: "web-search",
  tool_name: "search",
  arguments: {
    query: "your search query",
    limit: 3  // optional
  }
})
```

Example response:
```json
[
  {
    "title": "Example Search Result",
    "url": "https://example.com",
    "description": "Description of the search result..."
  }
]
```

## Limitations

Since this tool uses web scraping of Google search results, there are some important limitations to be aware of:

1. **Rate Limiting**: Google may temporarily block requests if too many searches are performed in a short time. To avoid this:
   - Keep searches to a reasonable frequency
   - Use the limit parameter judiciously
   - Consider implementing delays between searches if needed

2. **Result Accuracy**: 
   - The tool relies on Google's HTML structure, which may change
   - Some results might be missing descriptions or other metadata
   - Complex search operators may not work as expected

3. **Legal Considerations**:
   - This tool is intended for personal use
   - Respect Google's terms of service
   - Consider implementing appropriate rate limiting for your use case

## Contributing

Feel free to submit issues and enhancement requests!
