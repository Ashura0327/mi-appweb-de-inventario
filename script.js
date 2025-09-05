const entradas = [];
let productosDB = new Map();
let html5QrCode; 

// Base de datos de vendedores
const vendedoresDB = new Map([
    ["20556798", "Catalina"],
    ["45892345", "Juan David"],
    ["12234478", "Paola"]
]);

// Base de datos de usuarios y contraseñas
const usuariosDB = new Map([
    ["5035", { password: "clave", nombre: "Tienda de la 65", password_master: "master5035" }],
    ["5115", { password: "clave", nombre: "Tienda Guayabal", password_master: "master5115" }],
    ["5001", { password: "clave", nombre: "Tienda Centro", password_master: "master5001" }]
]);

// Elementos del DOM para el login
const loginContainer = document.getElementById('login-container');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const bodegueroCodeInput = document.getElementById('bodegueroCode');
const appContainer = document.getElementById('app-container');
const tiendaNombreH1 = document.getElementById('tienda-nombre');

const excelDataInput = document.getElementById('excel-data');
const processDataBtn = document.getElementById('process-data-btn');
const eanInput = document.getElementById('ean');
const referenciaInput = document.getElementById('referencia');
const colorInput = document.getElementById('color');
const tallaInput = document.getElementById('talla');
const nombreVendedorInput = document.getElementById('nombreVendedor');
const reportOutputDiv = document.getElementById('report-output');
const reportContentPre = document.getElementById('report-content');
const downloadBtn = document.getElementById('download-btn');
const downloadLink = document.getElementById('download-link');

const showDbBtn = document.getElementById('show-db-btn');
const dbForm = document.getElementById('db-form');

const historyList = document.getElementById('history-list');
const historyUl = document.getElementById('history-ul');

const readerDiv = document.getElementById('reader');
const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');

function guardarBaseDeDatos() {
    const objDB = Object.fromEntries(productosDB);
    localStorage.setItem('productosDB', JSON.stringify(objDB));
}

function cargarBaseDeDatos() {
    const dataGuardada = localStorage.getItem('productosDB');
    if (dataGuardada) {
        const objDB = JSON.parse(dataGuardada);
        productosDB = new Map(Object.entries(objDB));
        console.log(`✅ ${productosDB.size} productos cargados desde el almacenamiento local.`);
    }
}

function guardarEntradas() {
    localStorage.setItem('registros_inventario', JSON.stringify(entradas));
    renderHistory();
}

function cargarEntradas() {
    const dataGuardada = localStorage.getItem('registros_inventario');
    if (dataGuardada) {
        const registros = JSON.parse(dataGuardada);
        entradas.push(...registros);
        console.log(`✅ ${entradas.length} entradas de inventario cargadas desde la sesión anterior.`);
    }
}

function limpiarEntradas() {
    entradas.length = 0;
    localStorage.removeItem('registros_inventario');
    renderHistory();
}

function enviarDatosAlUsuarioPrincipal() {
    console.log(`📤 Enviando ${entradas.length} registros del día al usuario principal...`);
    limpiarEntradas();
    alert("¡Sincronización diaria completada! Los datos se han enviado y la sesión ha sido cerrada.");
}

function checkLogin() {
    const lastLoginDate = localStorage.getItem('lastLoginDate');
    const today = new Date().toDateString();
    
    if (lastLoginDate === today) {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            loginContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            tiendaNombreH1.textContent = `${loggedInUser}`;
            cargarEntradas();
            return;
        }
    } else {
        enviarDatosAlUsuarioPrincipal();
        localStorage.setItem('lastLoginDate', today);
    }

    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const bodegueroCode = bodegueroCodeInput.value.trim();
    
    if (usuariosDB.has(username)) {
        const usuario = usuariosDB.get(username);
        
        if (password === usuario.password_master) {
            localStorage.setItem('loggedInUser', usuario.nombre);
            checkLogin();
            bodegueroCodeInput.classList.add('hidden');
            alert(`¡Bienvenido, usuario principal de ${usuario.nombre}!`);
            return;
        }

        if (password === usuario.password) {
            if (bodegueroCode.length > 0) {
                 localStorage.setItem('loggedInUser', usuario.nombre);
                 localStorage.setItem('currentBodeguero', bodegueroCode);
                 checkLogin();
                 alert(`¡Bienvenido, ${bodegueroCode} de ${usuario.nombre}!`);
            } else {
                alert('Por favor, ingresa tu código de bodeguero.');
            }
        } else {
            alert('Contraseña incorrecta.');
        }

    } else {
        alert('Código de sede no encontrado.');
    }
}

function logout() {
    if (confirm("¿Estás seguro de que quieres cerrar sesión y enviar los registros del día?")) {
        enviarDatosAlUsuarioPrincipal();
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('currentBodeguero');
        localStorage.removeItem('lastLoginDate');
        checkLogin();
        stopCameraScan(); 
    }
}

window.onload = () => {
    cargarBaseDeDatos();
    checkLogin();
    checkDeviceAndHideCameraOption();
};

setInterval(() => {
    const now = new Date();
    if (now.getHours() === 19 && now.getMinutes() === 30 && entradas.length > 0) {
        enviarDatosAlUsuarioPrincipal();
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('currentBodeguero');
        checkLogin();
    }
}, 60000); 

function limpiarEan(ean) {
    if (ean === null || ean === undefined) return '';
    return String(ean).replace(/\s/g, '').trim();
}

showDbBtn.addEventListener('click', () => {
    dbForm.classList.toggle('hidden');
});

processDataBtn.addEventListener('click', () => {
    const data = excelDataInput.value.trim();
    if (!data) {
        alert("Por favor, pega los datos de tu base de datos en el área de texto.");
        return;
    }

    try {
        const worksheet = XLSX.read(data, { type: 'string' });
        const firstSheetName = worksheet.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(worksheet.Sheets[firstSheetName]);
        
        productosDB.clear();
        json.forEach(row => {
            if (row.EAN) {
                const eanLimpio = limpiarEan(row.EAN);
                productosDB.set(eanLimpio, {
                    referencia: row.Referencia,
                    color: row.Color,
                    talla: row.Talla
                });
            }
        });

        if (productosDB.size > 0) {
            guardarBaseDeDatos();
            alert(`✅ ¡Base de datos cargada y guardada! Se encontraron ${productosDB.size} productos.`);
            dbForm.classList.add('hidden');
        } else {
            alert('❌ Error: No se encontraron productos. Asegúrate de que las columnas se llamen exactamente "EAN", "Referencia", "Color" y "Talla".');
        }
    } catch (error) {
        alert('❌ Error al procesar los datos. Por favor, verifica el formato. Asegúrate de copiar las columnas desde Excel.');
        console.error("Error detallado:", error);
    }
});

function processScannedCode(decodedText) {
    const ean = limpiarEan(decodedText);
    const producto = productosDB.get(ean);

    if (eanInput.value === '') { 
        eanInput.value = ean;
        if (producto) {
            referenciaInput.value = producto.referencia || '';
            colorInput.value = producto.color || '';
            tallaInput.value = producto.talla || '';
            nombreVendedorInput.focus();
        } else {
            alert("EAN de producto no encontrado en la base de datos. Por favor, verifica el código.");
            eanInput.value = '';
            eanInput.focus();
        }
    } else { 
        const nombreVendedor = vendedoresDB.get(ean); 
        if (nombreVendedor) {
            nombreVendedorInput.value = nombreVendedor;
            ingresarReferencia();
            stopCameraScan(); 
        } else {
            alert("Código de vendedor no encontrado. Por favor, verifica el código.");
            nombreVendedorInput.value = '';
            nombreVendedorInput.focus();
        }
    }
}

eanInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        processScannedCode(eanInput.value);
    }
});

nombreVendedorInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        processScannedCode(nombreVendedorInput.value);
    }
});

function ingresarReferencia() {
    const ean = limpiarEan(eanInput.value);
    const nombreVendedor = nombreVendedorInput.value.trim();
    const producto = productosDB.get(ean);
    const bodeguero = localStorage.getItem('currentBodeguero') || 'No definido';

    if (!ean || !nombreVendedor) {
        return;
    }

    if (!producto) {
        return;
    }

    entradas.push({
        referencia: producto.referencia,
        color: producto.color,
        talla: producto.talla,
        nombreVendedor: nombreVendedor,
        bodeguero: bodeguero, 
        fechaHora: new Date().toLocaleString()
    });

    guardarEntradas();

    eanInput.value = '';
    referenciaInput.value = '';
    colorInput.value = '';
    tallaInput.value = '';
    nombreVendedorInput.value = '';
    eanInput.focus();
}

function finalizarPrograma() {
    if (entradas.length === 0) {
        alert("No se ingresaron referencias. El programa ha finalizado.");
        return;
    }

    reportOutputDiv.classList.remove('hidden');
    procesarReporte(entradas);
    stopCameraScan();
}

function procesarReporte(entradas) {
    const reportePorArticulo = new Map();

    for (const entrada of entradas) {
        const clave = `${entrada.referencia}-${entrada.color}-${entrada.talla}`;
        if (reportePorArticulo.has(clave)) {
            reportePorArticulo.get(clave).cantidad++;
            reportePorArticulo.get(clave).vendedores.push(entrada.nombreVendedor);
        } else {
            reportePorArticulo.set(clave, {
                referencia: entrada.referencia,
                color: entrada.color,
                talla: entrada.talla,
                cantidad: 1,
                vendedores: [entrada.nombreVendedor],
                bodeguero: entrada.bodeguero,
                fechaHora: entrada.fechaHora
            });
        }
    }

    let reporteDisplay = "--- Resumen de referencias ingresadas ---\n";
    let articuloMasIngresado = null;
    let maxCount = 0;

    for (const item of reportePorArticulo.values()) {
        const vendedores = item.vendedores.join(", ");
        reporteDisplay += `- Referencia: ${item.referencia}, Color: ${item.color}, Talla: ${item.talla}\n`;
        reporteDisplay += `  Cantidad: ${item.cantidad} unidades.\n`;
        reporteDisplay += `  Vendedores que la ingresaron: ${vendedores}\n`;
        reporteDisplay += `  Ingresado por: ${item.bodeguero} el ${item.fechaHora}\n\n`;

        if (item.cantidad > maxCount) {
            maxCount = item.cantidad;
            articuloMasIngresado = item;
        }
    }
    if (articuloMasIngresado) {
        reporteDisplay += `--- El artículo más ingresado fue ---\n`;
        reporteDisplay += `> Referencia: ${articuloMasIngresado.referencia}, Color: ${articuloMasIngresado.color}, Talla: ${articuloMasIngresado.talla}, con un total de ${maxCount} unidades.\n`;
    }

    reportContentPre.textContent = reporteDisplay;
    downloadBtn.classList.remove('hidden');

    let csvContent = "Referencia,Color,Talla,Cantidad,Vendedores,Bodeguero,Fecha y Hora\n";
    for (const item of reportePorArticulo.values()) {
        const vendedores = item.vendedores.join("; ");
        csvContent += `${item.referencia},${item.color},${item.talla},${item.cantidad},"${vendedores}",${item.bodeguero},"${item.fechaHora}"\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
}

function renderHistory() {
    historyUl.innerHTML = '';
    if (entradas.length > 0) {
        historyList.classList.remove('hidden');
        entradas.forEach((entrada, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `
                <span class="history-info">
                    **Ref:** ${entrada.referencia} | **Color:** ${entrada.color} | **Talla:** ${entrada.talla} | **Vendedor:** ${entrada.nombreVendedor} | **Bodeguero:** ${entrada.bodeguero}
                </span>
                <button class="delete-btn" data-index="${index}">X</button>
            `;
            historyUl.appendChild(li);
        });
    } else {
        historyList.classList.add('hidden');
    }
}

historyUl.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const index = e.target.getAttribute('data-index');
        if (confirm(`¿Estás seguro de que quieres eliminar la entrada para la referencia ${entradas[index].referencia}?`)) {
            entradas.splice(index, 1);
            guardarEntradas();
        }
    }
});

async function startCameraScan() {
    if (html5QrCode && html5QrCode.isScanning) {
        console.warn("El escáner ya está activo.");
        return;
    }

    readerDiv.classList.remove('hidden');
    startScanBtn.classList.add('hidden');
    stopScanBtn.classList.remove('hidden');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
        await html5QrCode.start({ facingMode: "environment" }, config, 
            (decodedText, decodedResult) => {
                console.log(`Code matched = ${decodedText}`, decodedResult);
                processScannedCode(decodedText);
            },
            (errorMessage) => {}
        );
        console.log("Escáner de cámara iniciado.");
    } catch (err) {
        alert(`Error al iniciar la cámara: ${err}. Asegúrate de que tu navegador tiene permiso para acceder a la cámara y que no esté siendo usada por otra aplicación.`);
        console.error("Error al iniciar la cámara:", err);
        stopCameraScan();
    }
}

async function stopCameraScan() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            console.log("Escáner de cámara detenido.");
        } catch (err) {
            console.error("Error al detener el escáner:", err);
        }
    }
    readerDiv.classList.add('hidden');
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
}

// NUEVA: Función para detectar el dispositivo
function checkDeviceAndHideCameraOption() {
    // La expresión regular busca patrones comunes de agentes de usuario en dispositivos móviles
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Si no es un dispositivo móvil, ocultamos el botón de la cámara
    if (!isMobile) {
        startScanBtn.classList.add('hidden');
    }
}