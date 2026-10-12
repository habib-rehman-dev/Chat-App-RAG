# src/features/chat/agent.py
from collections.abc import AsyncIterator

from llama_index.core.agent.workflow import AgentStream, FunctionAgent
from llama_index.core.llms import ChatMessage
from llama_index.llms.groq import Groq

from src.core.config import get_settings
from src.features.chat.tools import tools

settings = get_settings()

_llm = Groq(
    model=settings.llm_model_name,
    api_key=settings.LLM_API_KEY,
    temperature=settings.llm_model_temperature,
    max_tokens=512,
)

_agent = FunctionAgent(
    tools=tools,  # <-- ALL tools, not just tools[0]
    llm=_llm,
    system_prompt=(
        "You are a specialized support agent. Answer politely. "
        "Use `get_weather` when the user asks about weather for a location. "
        "Use `query_engine_tool` when the user asks about documents or needs "
        "information from the knowledge base. "
        "Do not invent answers — if a tool doesn't return useful info, say so."
    ),
    verbose=True,
    resolve_input_errors=True,
)


async def llm_stream(
    prompt: str,
    history: list[ChatMessage] | None = None,
) -> AsyncIterator[str]:
    """
    Stream the agent's reply as text deltas.

    `history` is the prior conversation as structured ChatMessages. Pass it
    every request — the agent does not persist memory across calls on its own.
    """
    handler = _agent.run(
        user_msg=prompt,
        chat_history=history or [],
    )

    async for event in handler.stream_events():
        if isinstance(event, AgentStream) and event.delta:
            yield event.delta

    # Ensure the workflow finishes cleanly (raises if the run failed).
    _ = await handler