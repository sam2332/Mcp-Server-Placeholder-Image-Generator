#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

interface GenerateImageArgs {
  width: number;
  height: number;
  color: string;
  filepath: string;
}

const isValidGenerateImageArgs = (args: any): args is GenerateImageArgs =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.width === 'number' &&
  typeof args.height === 'number' &&
  typeof args.color === 'string' &&
  typeof args.filepath === 'string' &&
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

    const { width, height, color, filepath } = args;

    if (!isValidColor(color)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid color: ${color}. Please use a valid hex code like #FF0000 or #f00.`
      );
    }

    try {
      // Generate PNG image
      const pngBuffer = this.generatePNG(width, height, color);
      
      // Create directory if it doesn't exist
      const dir = dirname(filepath);
      try {
        mkdirSync(dir, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore error
      }
      
      // Save to file
      writeFileSync(filepath, pngBuffer);

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

  private getContrastColor(backgroundColor: string): string {
    const { r, g, b } = hexToRgb(backgroundColor);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? 'black' : 'white';
  }

  private generatePNG(width: number, height: number, color: string): Buffer {
    const { r, g, b } = hexToRgb(color);
    
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);    // Width
    ihdrData.writeUInt32BE(height, 4);   // Height
    ihdrData.writeUInt8(8, 8);           // Bit depth
    ihdrData.writeUInt8(2, 9);           // Color type (RGB)
    ihdrData.writeUInt8(0, 10);          // Compression method
    ihdrData.writeUInt8(0, 11);          // Filter method
    ihdrData.writeUInt8(0, 12);          // Interlace method
    
    const ihdrCrc = this.crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
    const ihdr = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x0D]), // Length
      Buffer.from('IHDR'),
      ihdrData,
      Buffer.alloc(4)
    ]);
    ihdr.writeUInt32BE(ihdrCrc, ihdr.length - 4);
    
    // Create image data - simple solid color
    const pixelData = Buffer.alloc(width * height * 3);
    for (let i = 0; i < pixelData.length; i += 3) {
      pixelData[i] = r;     // Red
      pixelData[i + 1] = g; // Green
      pixelData[i + 2] = b; // Blue
    }
    
    // Add filter bytes (one per row - using filter type 0: None)
    const imageData = Buffer.alloc(height + pixelData.length);
    let pos = 0;
    for (let y = 0; y < height; y++) {
      imageData[pos++] = 0; // Filter type (None)
      for (let x = 0; x < width * 3; x++) {
        imageData[pos++] = pixelData[y * width * 3 + x];
      }
    }
    
    // Compress image data using deflate
    const compressedData = this.deflateData(imageData);
    
    // IDAT chunk
    const idatCrc = this.crc32(Buffer.concat([Buffer.from('IDAT'), compressedData]));
    const idat = Buffer.concat([
      Buffer.alloc(4), // Length (will be set)
      Buffer.from('IDAT'),
      compressedData,
      Buffer.alloc(4)
    ]);
    idat.writeUInt32BE(compressedData.length, 0);
    idat.writeUInt32BE(idatCrc, idat.length - 4);
    
    // IEND chunk
    const iendCrc = this.crc32(Buffer.from('IEND'));
    const iend = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length
      Buffer.from('IEND'),
      Buffer.alloc(4)
    ]);
    iend.writeUInt32BE(iendCrc, iend.length - 4);
    
    return Buffer.concat([signature, ihdr, idat, iend]);
  }

  private deflateData(data: Buffer): Buffer {
    // Simple deflate implementation - just adds deflate headers without actual compression
    // This creates valid but uncompressed deflate data
    const blocks = [];
    const maxBlockSize = 65535;
    
    for (let i = 0; i < data.length; i += maxBlockSize) {
      const blockData = data.subarray(i, Math.min(i + maxBlockSize, data.length));
      const isLast = i + maxBlockSize >= data.length;
      
      // Block header: BFINAL (1 bit) + BTYPE (2 bits, 00 = no compression)
      const blockHeader = Buffer.from([isLast ? 0x01 : 0x00]);
      
      // Block length and complement
      const len = blockData.length;
      const nlen = 0xFFFF - len;
      const lengthBytes = Buffer.alloc(4);
      lengthBytes.writeUInt16LE(len, 0);
      lengthBytes.writeUInt16LE(nlen, 2);
      
      blocks.push(blockHeader, lengthBytes, blockData);
    }
    
    // Deflate stream: CMF + FLG + blocks + Adler32
    const cmf = 0x78; // CM=8 (deflate), CINFO=7 (32K window)
    const flg = 0x01; // FCHECK=1, FDICT=0, FLEVEL=0
    const header = Buffer.from([cmf, flg]);
    
    const blockData = Buffer.concat(blocks);
    const adler = this.adler32(data);
    const adlerBytes = Buffer.alloc(4);
    adlerBytes.writeUInt32BE(adler, 0);
    
    return Buffer.concat([header, blockData, adlerBytes]);
  }

  private crc32(data: Buffer): number {
    const crcTable: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }
    
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private adler32(data: Buffer): number {
    let a = 1;
    let b = 0;
    const MOD_ADLER = 65521;
    
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % MOD_ADLER;
      b = (b + a) % MOD_ADLER;
    }
    
    return (b << 16) | a;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Generator MCP server running on stdio');
  }
}

const server = new ImageGeneratorServer();
server.run().catch(console.error);
