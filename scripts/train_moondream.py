"""
Script conceptual para reentrenar Moondream v2 con tu dataset.
Este archivo NO se ejecuta en Node.js, requiere Python, PyTorch y transformers.

Instrucciones:
1. Exportar el dataset con: npx ts-node scripts/export-ocr-dataset.ts
2. Esto generará la carpeta "ocr_dataset" fuera de backend, con imágenes y un "metadata.jsonl".
3. En un entorno Python 3.10+ (preferiblemente un VPS o Google Colab con GPU):
   pip install torch transformers datasets peft accelerate
4. Ejecutar: python train_moondream.py
"""

import os
from datasets import load_dataset
from transformers import AutoProcessor, AutoModelForCausalLM, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model

def main():
    dataset_dir = "../ocr_dataset"
    print("Cargando dataset desde:", dataset_dir)
    
    # Hugging Face Datasets lee el metadata.jsonl y arma las tuplas (image, text)
    dataset = load_dataset("imagefolder", data_dir=dataset_dir)
    print("Ejemplos encontrados:", len(dataset["train"]))

    model_id = "vikhyatk/moondream2"
    processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True)
    
    # Low-Rank Adaptation (LoRA) - Esto evita gastar 100GB de RAM y entrena rápido
    config = LoraConfig(
        r=16, 
        lora_alpha=32, 
        target_modules=["c_proj", "c_attn"], # Depende de la arquitectura de moondream
        lora_dropout=0.05, 
        bias="none", 
        task_type="CAUSAL_LM"
    )
    
    peft_model = get_peft_model(model, config)
    peft_model.print_trainable_parameters()

    # Data collator para preparar las imagenes y textos al formato tensor
    def collate_fn(examples):
        images = [ex["image"] for ex in examples]
        texts = [ex["text"] for ex in examples]
        inputs = processor(text=texts, images=images, return_tensors="pt", padding=True)
        inputs["labels"] = inputs["input_ids"].clone()
        return inputs

    training_args = TrainingArguments(
        output_dir="./moondream-condominio-finetuned",
        per_device_train_batch_size=2, # Ajustar según tu memoria de GPU
        gradient_accumulation_steps=4,
        num_train_epochs=3, # Repetir 3 veces por el dataset completo
        learning_rate=2e-4,
        logging_steps=10,
        save_strategy="epoch",
        fp16=True, # Acelera el proceso en GPUs nvidia
        remove_unused_columns=False
    )

    trainer = Trainer(
        model=peft_model,
        args=training_args,
        train_dataset=dataset["train"],
        data_collator=collate_fn,
    )

    print("Iniciando Fine-Tuning de Moondream...")
    trainer.train()
    
    print("Guardando modelo final...")
    trainer.save_model("moondream-condominio-final")
    print("Listo. Ahora debes exportar este modelo a GGUF/Ollama para usarlo.")

if __name__ == "__main__":
    main()
