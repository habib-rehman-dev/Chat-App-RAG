# src/features/chat/tools.py
from llama_index.core.tools import FunctionTool, QueryEngineTool, ToolMetadata

from src.core.vectorStoreIndex import get_query_engine


def get_weather(location: str) -> str:
    """Gets the current weather for a given location."""
    return f"The weather in {location} is 22°C and sunny."


weather_tool = FunctionTool(
    metadata=ToolMetadata(
        name="get_weather",
        description="Gets the current weather for a given location.",
        return_direct=True,
    ),
    fn=get_weather,
)


query_engine_tool = QueryEngineTool.from_defaults(
    query_engine=get_query_engine(),
    name="query_engine_tool",
    description="A tool to query the vector store index for document information.",
)

tools = [weather_tool, query_engine_tool]