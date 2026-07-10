"""Convert AI Studio JSONL format to Vertex AI Gemini fine-tuning format."""
import json, os

src_dir = os.path.dirname(os.path.abspath(__file__))
files = [
    "finetune_email_writer",
    "finetune_lead_scorer",
    "finetune_enrichment",
    "finetune_icp_matcher",
]

for name in files:
    src = os.path.join(src_dir, f"{name}.jsonl")
    dst = os.path.join(src_dir, f"{name}_vertex.jsonl")
    count = 0
    with open(src) as fin, open(dst, "w") as fout:
        for line in fin:
            row = json.loads(line)
            vertex_row = {
                "contents": [
                    {"role": "user",  "parts": [{"text": row["text_input"]}]},
                    {"role": "model", "parts": [{"text": row["output"]}]},
                ]
            }
            fout.write(json.dumps(vertex_row) + "\n")
            count += 1
    print(f"  Converted {count} examples → {dst}")

print("\nDone! Upload the *_vertex.jsonl files to Vertex AI.")
