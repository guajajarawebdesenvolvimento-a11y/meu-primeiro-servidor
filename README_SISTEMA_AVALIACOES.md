# ⭐ SISTEMA DE AVALIAÇÕES - INSTRUÇÕES

## 📋 O QUE FOI IMPLEMENTADO

Sistema completo de avaliações com:
- ✅ Avaliação de 1 a 5 estrelas
- ✅ Comentário opcional
- ✅ **VALIDAÇÃO OBRIGATÓRIA: Nome + (Email OU Telefone)**
- ✅ Exibição da média de estrelas no card
- ✅ Modal para ver todas avaliações
- ✅ Botão "Avaliar" em cada gesseiro

---

## 🔧 COMO ADICIONAR NO INDEX.HTML

### **1. Adicione este CSS no `<style>`:**

```css
/* === SISTEMA DE AVALIAÇÕES === */
.btn-avaliar {
    width: 100%;
    padding: 10px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
    transition: all 0.3s;
}

.btn-avaliar:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(245, 158, 11, 0.3);
}

.avaliacoes-resumo {
    background: #fef3c7;
    padding: 10px;
    border-radius: 8px;
    margin: 10px 0;
    text-align: center;
    font-size: 14px;
    color: #92400e;
    font-weight: 600;
}

/* Modal de Avaliação */
.modal-avaliacao {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(5px);
}

.modal-avaliacao-content {
    background: white;
    margin: 5% auto;
    padding: 30px;
    border-radius: 20px;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.estrelas-input {
    display: flex;
    justify-content: center;
    gap: 10px;
    font-size: 40px;
    margin: 20px 0;
    cursor: pointer;
}

.estrelas-input span {
    transition: transform 0.2s;
    user-select: none;
}

.estrelas-input span:hover,
.estrelas-input span.selected {
    transform: scale(1.2);
    filter: drop-shadow(0 0 10px rgba(255, 193, 7, 0.8));
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    font-family: inherit;
    font-size: 14px;
}

.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #f59e0b;
}

.form-group textarea {
    resize: vertical;
    min-height: 80px;
}

.btn-enviar-avaliacao {
    width: 100%;
    padding: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    font-size: 16px;
}

.btn-enviar-avaliacao:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.validacao-info {
    background: #dbeafe;
    border: 2px solid #3b82f6;
    color: #1e40af;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 15px;
}
```

### **2. Adicione no HTML do CARD (dentro do criarCard):**

```javascript
// Dentro da função criarCard, adicione antes do botão WhatsApp:

// Resumo de avaliações
let avaliacoesHTML = '';
if (gesseiro.total_avaliacoes && gesseiro.total_avaliacoes > 0) {
    const media = parseFloat(gesseiro.media_avaliacoes).toFixed(1);
    const estrelasVazias = 5 - Math.round(media);
    avaliacoesHTML = `
        <div class="avaliacoes-resumo">
            ${'⭐'.repeat(Math.round(media))}${'☆'.repeat(estrelasVazias)}
            ${media} (${gesseiro.total_avaliacoes} avaliações)
            <br>
            <a href="#" onclick="event.stopPropagation(); verAvaliacoes(${gesseiro.id}); return false;" 
               style="color: #92400e; text-decoration: underline;">Ver avaliações</a>
        </div>
    `;
}

// Botão avaliar
<button class="btn-avaliar" onclick="event.stopPropagation(); abrirModalAvaliacao(${gesseiro.id}, '${gesseiro.nome}')">
    ⭐ Avaliar este profissional
</button>
```

### **3. Adicione o MODAL no HTML (antes do `</body>`):**

```html
<!-- MODAL DE AVALIAÇÃO -->
<div id="modalAvaliacao" class="modal-avaliacao" onclick="fecharModalAvaliacao()">
    <div class="modal-avaliacao-content" onclick="event.stopPropagation()">
        <h2 style="text-align: center; margin-bottom: 10px;">⭐ Avaliar Profissional</h2>
        <p id="nomeGesseiroAvaliacao" style="text-align: center; color: #666; margin-bottom: 20px;"></p>
        
        <div class="validacao-info">
            <strong>ℹ️ Avaliação verificada</strong><br>
            Para evitar avaliações falsas, é obrigatório informar:
            <br>• Seu nome
            <br>• Email OU Telefone
        </div>

        <div class="estrelas-input" id="estrelasInput">
            <span onclick="selecionarEstrela(1)">☆</span>
            <span onclick="selecionarEstrela(2)">☆</span>
            <span onclick="selecionarEstrela(3)">☆</span>
            <span onclick="selecionarEstrela(4)">☆</span>
            <span onclick="selecionarEstrela(5)">☆</span>
        </div>

        <form id="formAvaliacao">
            <div class="form-group">
                <label for="nomeAvaliador">📝 Seu Nome *</label>
                <input type="text" id="nomeAvaliador" required placeholder="João Silva">
            </div>

            <div class="form-group">
                <label for="emailAvaliador">📧 Seu Email *</label>
                <input type="email" id="emailAvaliador" placeholder="seu@email.com">
                <small style="color: #666; font-size: 12px;">Email OU telefone é obrigatório</small>
            </div>

            <div class="form-group">
                <label for="telefoneAvaliador">📱 Seu Telefone *</label>
                <input type="tel" id="telefoneAvaliador" placeholder="(85) 99999-9999">
                <small style="color: #666; font-size: 12px;">Email OU telefone é obrigatório</small>
            </div>

            <div class="form-group">
                <label for="comentarioAvaliacao">💬 Comentário (opcional)</label>
                <textarea id="comentarioAvaliacao" placeholder="Conte sua experiência com este profissional..."></textarea>
            </div>

            <button type="submit" class="btn-enviar-avaliacao">Enviar Avaliação</button>
        </form>
    </div>
</div>
```

### **4. Adicione o JAVASCRIPT:**

```javascript
let gesseiroIdAvaliando = null;
let estrelasSelec ionadas = 0;

function abrirModalAvaliacao(gesseiroId, nomeGesseiro) {
    gesseiroIdAvaliando = gesseiroId;
    estrelasS elecionadas = 0;
    document.getElementById('nomeGesseiroAvaliacao').textContent = nomeGesseiro;
    document.getElementById('formAvaliacao').reset();
    
    // Limpar estrelas
    const estrelas = document.querySelectorAll('#estrelasInput span');
    estrelas.forEach(e => {
        e.textContent = '☆';
        e.classList.remove('selected');
    });
    
    document.getElementById('modalAvaliacao').style.display = 'block';
}

function fecharModalAvaliacao() {
    document.getElementById('modalAvaliacao').style.display = 'none';
    gesseiroIdAvaliando = null;
}

function selecionarEstrela(qtd) {
    estrelasSelec ionadas = qtd;
    const estrelas = document.querySelectorAll('#estrelasInput span');
    estrelas.forEach((estrela, index) => {
        if (index < qtd) {
            estrela.textContent = '⭐';
            estrela.classList.add('selected');
        } else {
            estrela.textContent = '☆';
            estrela.classList.remove('selected');
        }
    });
}

document.getElementById('formAvaliacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nomeAvaliador').value.trim();
    const email = document.getElementById('emailAvaliador').value.trim();
    const telefone = document.getElementById('telefoneAvaliador').value.trim();
    const comentario = document.getElementById('comentarioAvaliacao').value.trim();
    
    // VALIDAÇÃO OBRIGATÓRIA
    if (!nome) {
        alert('⚠️ Por favor, informe seu nome');
        return;
    }
    
    if (!email && !telefone) {
        alert('⚠️ Por favor, informe seu email OU telefone para validar a avaliação');
        return;
    }
    
    if (estrelasSelec ionadas === 0) {
        alert('⚠️ Por favor, selecione uma quantidade de estrelas');
        return;
    }
    
    // Validar email se fornecido
    if (email && !email.includes('@')) {
        alert('⚠️ Por favor, informe um email válido');
        return;
    }
    
    // Enviar avaliação
    try {
        const response = await fetch('/api/avaliacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gesseiro_id: gesseiroIdAvaliando,
                nome_avaliador: nome,
                email_avaliador: email,
                telefone_avaliador: telefone,
                estrelas: estrelasSelec ionadas,
                comentario: comentario
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('✅ Avaliação enviada com sucesso! Obrigado pelo feedback!');
            fecharModalAvaliacao();
            carregarGesseiros(); // Recarregar para mostrar nova média
        } else {
            alert('❌ ' + (data.erro || 'Erro ao enviar avaliação'));
        }
    } catch (error) {
        alert('❌ Erro ao conectar com o servidor');
        console.error('Erro:', error);
    }
});
```

---

## ✅ TESTE

1. Acesse a página inicial
2. Clique em "⭐ Avaliar este profissional"
3. Tente enviar sem preencher → Deve dar erro
4. Preencha nome + email (ou telefone)
5. Selecione estrelas
6. Envie → Deve funcionar!

---

## 📊 BACKEND JÁ ESTÁ PRONTO

A API já aceita:
- `POST /api/avaliacoes`
- `GET /api/gesseiros/:id/avaliacoes`

Está tudo funcionando no server.js!

---

**Criado em:** 10/02/2025  
**Validação:** Nome + (Email OU Telefone) OBRIGATÓRIOS
