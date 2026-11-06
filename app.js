// ===== VM Opcodes =====
const OP = { PUSH: 240, ADD: 241, SUB: 242, XOR: 243, EMIT: 244 };
const OP_LIST = [OP.ADD, OP.SUB, OP.XOR];

const rand = n => Math.floor(Math.random() * n);

// ===== สร้าง bytecode ของ 1 ตัวอักษร (depth 3) =====
function genCharBytecode(v) {
  const op3 = OP_LIST[rand(3)];
  const d = rand(256);
  let target;
  if (op3 === OP.ADD) target = (v - d + 256) % 256;
  else if (op3 === OP.SUB) target = (v + d) % 256;
  else target = v ^ d;

  const op2 = OP_LIST[rand(3)];
  const c = rand(256);
  let target2;
  if (op2 === OP.ADD) target2 = (target - c + 256) % 256;
  else if (op2 === OP.SUB) target2 = (target + c) % 256;
  else target2 = target ^ c;

  const op1 = OP_LIST[rand(3)];
  let a, b;
  if (op1 === OP.ADD) { a = rand(256); b = (target2 - a + 256) % 256; }
  else if (op1 === OP.SUB) { b = rand(256); a = (target2 + b) % 256; }
  else { a = rand(256); b = a ^ target2; }

  return [
    OP.PUSH, a, OP.PUSH, b, op1,
    OP.PUSH, c, op2,
    OP.PUSH, d, op3,
    OP.EMIT
  ];
}

// ===== เข้ารหัสทั้งโปรแกรม: reverse → XOR(derived key) → hex =====
function encodeProgram(program) {
  // decoy ด้านหน้า (push ทิ้ง ไม่ emit)
  const decoyCount = 3 + rand(5);
  const decoys = [];
  for (let i = 0; i < decoyCount; i++) decoys.push(OP.PUSH, rand(256));

  const full = decoys.concat(program);
  const rev = full.slice().reverse();

  const keyLen = 8 + rand(8);
  const key = [];
  for (let i = 0; i < keyLen; i++) key.push(rand(256));

  const xored = rev.map((byte, i) => {
    const derived = key[i % keyLen] ^ ((i * 7 + 13) % 256);
    return byte ^ derived;
  });

  const hex = xored.map(b => b.toString(16).padStart(2, '0')).join('');
  const keyHex = key.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hex, keyHex };
}

// ===== สร้าง Lua loader =====
function buildLua(hex, keyHex) {
  return `loadstring(game:HttpGet((function()
local _H="${hex}";
local _K="${keyHex}";
local function _bx(a,b)
local r,p=0,1;
while a>0 or b>0 do
local x,y=a%2,b%2;
if x~=y then r=r+p end;
a=math.floor(a/2);
b=math.floor(b/2);
p=p*2;
end;
return r;
end;
local _ks={};
for i=1,#_K,2 do _ks[#_ks+1]=tonumber(_K:sub(i,i+1),16); end;
local _n=math.floor(#_H/2);
local _r={};
for i=1,_n do
local v=tonumber(_H:sub(i*2-1,i*2),16);
local ki=((i-1)%#_ks)+1;
local dk=_bx(_ks[ki],((i-1)*7+13)%256);
_r[i]=_bx(v,dk);
end;
local _p={};
for i=_n,1,-1 do _p[#_p+1]=_r[i]; end;
local _st={};
local _sp=0;
local _o={};
local _i=1;
while _i<=#_p do
local op=_p[_i];
if op==240 then
_sp=_sp+1;_st[_sp]=_p[_i+1];_i=_i+2;
elseif op==241 then
local b=_st[_sp];_sp=_sp-1;
local a=_st[_sp];_sp=_sp-1;
_sp=_sp+1;_st[_sp]=(a+b)%256;_i=_i+1;
elseif op==242 then
local b=_st[_sp];_sp=_sp-1;
local a=_st[_sp];_sp=_sp-1;
_sp=_sp+1;_st[_sp]=(a-b+256)%256;_i=_i+1;
elseif op==243 then
local b=_st[_sp];_sp=_sp-1;
local a=_st[_sp];_sp=_sp-1;
_sp=_sp+1;_st[_sp]=_bx(a,b);_i=_i+1;
elseif op==244 then
_o[#_o+1]=string.char(_st[_sp]);_sp=_sp-1;_i=_i+1;
else
_i=_i+1;
end;
end;
return table.concat(_o);
end)()))()`;
}

// ===== UI =====
document.getElementById('go').addEventListener('click', () => {
  const url = document.getElementById('url').value.trim();
  if (!url) { document.getElementById('url').focus(); return; }

  const bytes = Array.from(new TextEncoder().encode(url));
  const program = [];
  for (const v of bytes) program.push(...genCharBytecode(v));

  const { hex, keyHex } = encodeProgram(program);
  const lua = buildLua(hex, keyHex);

  document.getElementById('out').textContent = lua;
  document.getElementById('resultCard').style.display = 'block';
});

document.getElementById('copy').addEventListener('click', () => {
  const txt = document.getElementById('out').textContent;
  navigator.clipboard.writeText(txt).then(() => {
    const b = document.getElementById('copy');
    b.textContent = 'คัดลอกแล้ว ✓';
    setTimeout(() => b.textContent = 'คัดลอก', 1400);
  });
});