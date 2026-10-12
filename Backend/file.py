from llama_index.core.node_parser import TokenTextSplitter

# from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# 1. Setup your embedding model
# Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")

# 2. Create a splitter based on tokens (e.g., max 200 tokens per chunk)
# This prevents data from being cut off accidentally
splitter = TokenTextSplitter(
    chunk_size=200,        # Safe size under the model's limit
    chunk_overlap=20       # Overlap so sentences aren't awkwardly cut in half
)

long_text = "randdom long text to test the splitter. like here can be any kind of text of  " * 50  # Simulate a long text

chunks = splitter.split_text(long_text)

print(chunks)
