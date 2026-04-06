require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const OpenAI = require('openai');

const server = new Server(
  {
    name: 'dalle3-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_image_dalle3',
        description: 'Generate an image using OpenAI DALL-E 3.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { 
              type: 'string', 
              description: 'The detailed prompt to generate the image' 
            },
            size: { 
              type: 'string', 
              enum: ['1024x1024', '1024x1792', '1792x1024'], 
              default: '1024x1024' 
            },
            style: {
              type: 'string',
              enum: ['vivid', 'natural'],
              default: 'vivid',
              description: 'The style of the generated images.'
            }
          },
          required: ['prompt'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'generate_image_dalle3') {
    const { prompt, size = '1024x1024', style = 'vivid' } = request.params.arguments;
    try {
      const openai = new OpenAI(); // 這裡才建立 Client，若環境變數沒給 OPENAI_API_KEY 就會拋錯
      // 呼叫 OpenAI API
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        style,
        response_format: 'url',
      });

      const imageUrl = response.data[0].url;
      const revisedPrompt = response.data[0].revised_prompt;

      return {
        content: [
          { type: 'text', text: `圖片已成功生成！\n\nURL: ${imageUrl}\n\n實際使用的 Prompt (Revised): ${revisedPrompt}` }
        ],
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `生成錯誤: ${e.message}` }],
        isError: true,
      };
    }
  }
  throw new Error('Tool not found');
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DALL-E 3 MCP Server is running!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
