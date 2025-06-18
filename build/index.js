#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
const isValidGenerateImageArgs = (args) => typeof args === 'object' &&
    args !== null &&
    typeof args.width === 'number' &&
    typeof args.height === 'number' &&
    typeof args.color === 'string' &&
    args.width > 0 &&
    args.height > 0 &&
    args.width <= 4096 &&
    args.height <= 4096;
const isValidColor = (color) => {
    // Check if it's a valid hex color (e.g., #FF0000, #f00)
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
};
const hexToRgb = (hex) => {
    // Remove # if present
    hex = hex.replace('#', '');
    // Convert 3-char hex to 6-char
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return { r, g, b };
};
class ImageGeneratorServer {
    server;
    constructor() {
        this.server = new Server({
            name: 'image-gen',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'generate_test_image',
                    description: 'Generate a test image with specified width, height, and color',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            width: {
                                type: 'number',
                                description: 'Width of the image in pixels (1-4096)',
                                minimum: 1,
                                maximum: 4096
                            },
                            height: {
                                type: 'number',
                                description: 'Height of the image in pixels (1-4096)',
                                minimum: 1,
                                maximum: 4096
                            },
                            color: {
                                type: 'string',
                                description: 'Color of the image as hex code (e.g., #FF0000 or #f00)',
                                pattern: '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$'
                            }
                        },
                        required: ['width', 'height', 'color']
                    }
                }
            ]
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'generate_test_image':
                    return await this.handleGenerateImage(request.params.arguments);
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleGenerateImage(args) {
        if (!isValidGenerateImageArgs(args)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for generate_test_image. Required: width (number 1-4096), height (number 1-4096), color (hex string like #FF0000)');
        }
        const { width, height, color } = args;
        if (!isValidColor(color)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid color: ${color}. Please use a valid hex code like #FF0000 or #f00.`);
        }
        try {
            // Generate a simple SVG instead of PNG for easier generation
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 10}" 
        fill="${this.getContrastColor(color)}">${width}x${height}</text>
</svg>`;
            // Convert SVG to base64
            const base64 = Buffer.from(svg).toString('base64');
            return {
                content: [
                    {
                        type: 'text',
                        text: `Generated test image: ${width}x${height} pixels with color ${color}`
                    },
                    {
                        type: 'text',
                        text: `Base64 SVG data: data:image/svg+xml;base64,${base64}`
                    }
                ]
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getContrastColor(backgroundColor) {
        const { r, g, b } = hexToRgb(backgroundColor);
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? 'black' : 'white';
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Image Generator MCP server running on stdio');
    }
}
const server = new ImageGeneratorServer();
server.run().catch(console.error);
