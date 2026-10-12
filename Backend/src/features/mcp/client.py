import asyncio
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.groq import Groq

async def connect_mcp_and_run():
    # 1. Provide the exact command used to launch the stdio server
    mcp_client = BasicMCPClient(command_or_url="uv run agentic-terminal-habib")

    # 2. Fetch the tools exposed by 'File-Manager-Server'
    mcp_spec = McpToolSpec(client=mcp_client)
    mcp_tools = await mcp_spec.to_tool_list_async()

    print("Loaded tools:", [tool.metadata.name for tool in mcp_tools])

    # 3. Attach the tools to your FunctionAgent
    llm = Groq(model="llama-3.3-70b-versatile", api_key="YOUR_GROQ_API_KEY")
    agent = FunctionAgent(
        tools=mcp_tools,
        llm=llm
    )

    # 4. Run queries using your File-Manager-Server tools
    response = await agent.run("List the files in the current workspace directory.")
    print(response)

if __name__ == "__main__":
    asyncio.run(connect_mcp_and_run())