#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

interface GenerateImageArgs {
  width: number;
  height: number;
  color: string;
  filepath: string;
  label?: string;
}

const isValidGenerateImageArgs = (args: any): args is GenerateImageArgs =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.width === 'number' &&
  typeof args.height === 'number' &&
  typeof args.color === 'string' &&
  typeof args.filepath === 'string' &&
  (args.label === undefined || typeof args.label === 'string') &&
  args.width > 0 &&
  args.height > 0 &&
  args.width <= 4096 &&
  args.height <= 4096;

const isValidColor = (color: string): boolean => {
  // Check if it's a valid hex color (e.g., #FF0000, #f00)
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
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
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'image-gen',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_test_image',
          description: 'Generate a test image and save it to a specified file path',
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
              },
              filepath: {
                type: 'string',
                description: 'Full path where the PNG image should be saved (e.g., /path/to/image.png)'
              },
              label: {
                type: 'string',
                description: 'Optional custom label text to display on the image'
              }
            },
            required: ['width', 'height', 'color', 'filepath']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'generate_test_image':
          return await this.handleGenerateImage(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGenerateImage(args: unknown) {
    if (!isValidGenerateImageArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for generate_test_image. Required: width (number 1-4096), height (number 1-4096), color (hex string like #FF0000), filepath (string)'
      );
    }

    const { width, height, color, filepath, label } = args;

    if (!isValidColor(color)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid color: ${color}. Please use a valid hex code like #FF0000 or #f00.`
      );
    }

    try {
      await this.generateImage(width, height, color, filepath, label);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully generated and saved test image: ${width}x${height} pixels with color ${color} to ${filepath}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate or save image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async generateImage(width: number, height: number, color: string, filename: string, label?: string): Promise<void> {
    try {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      console.error(`Generating image: ${width}x${height}, color: ${color}`);

      // Set global composite operation to ensure colors work
      ctx.globalCompositeOperation = 'source-over';

      // Fill background with the specified color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      console.error(`Background filled with color: ${color}`);

      // Add text to show dimensions
      const fontSize = Math.max(Math.min(width, height) / 8, 16);
      ctx.font = `bold ${fontSize}px Arial`;
      const textColor = this.getContrastColor(color);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = `${width}x${height}`;
      console.error(`Adding text: ${text} with color: ${textColor}, fontSize: ${fontSize}`);
      
      // Add a stroke to make text more visible
      ctx.strokeStyle = textColor === 'white' ? 'black' : 'white';
      ctx.lineWidth = 2;
      ctx.strokeText(text, width / 2, height / 2);
      ctx.fillText(text, width / 2, height / 2);

      // Add label if provided
      if (label) {
        const labelFontSize = Math.max(Math.min(width, height) / 20, 12);
        ctx.font = `${labelFontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const padding = 10;
        console.error(`Adding label: ${label} with fontSize: ${labelFontSize}`);
        
        // Add stroke for label
        ctx.lineWidth = 1;
        ctx.strokeText(label, padding, padding);
        ctx.fillText(label, padding, padding);
      }

      // Ensure directory exists
      const dir = path.dirname(filename);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Try different PNG options
      const buffer = canvas.toBuffer('image/png', { 
        compressionLevel: 3, 
        filters: canvas.PNG_FILTER_NONE 
      });
      
      const outPath = path.resolve(filename);
      fs.writeFileSync(outPath, buffer);
      
      console.error(`Image saved to ${outPath}, buffer size: ${buffer.length}`);
      
    } catch (error) {
      console.error('Error in generateImage:', error);
      throw error;
    }
  }

  private getContrastColor(backgroundColor: string): string {
    const { r, g, b } = hexToRgb(backgroundColor);
    
    console.error(`RGB values: r=${r}, g=${g}, b=${b}`);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    console.error(`Luminance: ${luminance}`);
    
    const contrastColor = luminance > 0.5 ? 'black' : 'white';
    console.error(`Contrast color: ${contrastColor}`);
    
    return contrastColor;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Generator MCP server running on stdio');
  }
}

const server = new ImageGeneratorServer();
server.run().catch(console.error);
