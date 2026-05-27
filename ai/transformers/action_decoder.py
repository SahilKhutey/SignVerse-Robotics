import torch
import torch.nn as nn
import math

class CausalMotionDecoder(nn.Module):
    def __init__(self, vocab_size, d_model=256, nhead=8, num_layers=4):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        
        decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead)
        self.transformer_decoder = nn.TransformerDecoder(decoder_layer, num_layers=num_layers)
        self.fc_out = nn.Linear(d_model, vocab_size)
        
    def generate_square_subsequent_mask(self, sz):
        '''
        Creates a causal mask ensuring the model cannot look into the future.
        '''
        mask = (torch.triu(torch.ones(sz, sz)) == 1).transpose(0, 1)
        mask = mask.float().masked_fill(mask == 0, float('-inf')).masked_fill(mask == 1, float(0.0))
        return mask
        
    def forward(self, tgt, memory, tgt_mask=None):
        tgt_emb = self.embedding(tgt) * math.sqrt(tgt.shape[-1])
        
        if tgt_mask is None:
            tgt_mask = self.generate_square_subsequent_mask(tgt.size(0)).to(tgt.device)
            
        output = self.transformer_decoder(tgt_emb, memory, tgt_mask=tgt_mask)
        return self.fc_out(output)
