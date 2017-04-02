/************************************************************
 * Global variables
 ************************************************************/
var myNavigator = document.querySelector("#myNavigator");
var cacheShipmentList = [];
var cacheSearchResult = [];
var cacheShipSearchResult = [];
var cacheReceiveList = [];
var cacheTransferList = [];
var cacheLocationList = [];
var cacheCarriorList = [];
var cacheShipContainerList = [];
var cacheParentOpp = {};
var selectedLocation;
var loggedInContact = {};
var lastBarcode;
var lastTrailerId;
var verifyId;
var highlightShipment = {};
var highlightShipmentId;
var highlightOppId;
var highlightOpp;
//var eventType = window.cordova ? 'touchend' : 'click';
var eventType = 'click';
var scannerSettings = {
            preferFrontCamera: false, // iOS and Android
            showFlipCameraButton: false, // iOS and Android
            showTorchButton: false, // iOS and Android
            torchOn: false, // Android, launch with the torch switched on (if available)
            prompt: "Place a barcode inside the scan area", // Android
            resultDisplayDuration: 500, // Android, display scanned text for X ms. 0 suppresses it entirely, default 1500
            //formats : "QR_CODE,PDF_417", // default: all but PDF_417 and RSS_EXPANDED
            orientation: "landscape", // Android only (portrait|landscape), default unset so it rotates with the device
            disableAnimations: true // iOS
        }

/************************************************************
 * Initialization methods
 ************************************************************/
document.addEventListener("deviceready", onDeviceReady, false);
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function() {
        FastClick.attach(document.body);
    }, false);
}
function onDeviceReady() {
    /* On load of application logging into Salesforce */
    force.init({
        loginURL : "https://test.salesforce.com"
        //,appId    : "3MVG9AJuBE3rTYDgydi2NvUYTslwwaa00MYTa0hQHDft31WywZwgJbkpmGV4BGTKAMazWbPbz6wy0X2fRtRrj"
    });
    force.login(
        function () {
            lockScreen();
            getLocationList();
            refreshData();
            setOnloadBindings();
            getCarrierList();
        },
        function (error) {
            console.log("Auth failed: " + error);
            ons.notification.alert("Error message");
        }
    );
    
    console.log(navigator.camera);
//    window.localStorage.setItem("isCameraEnabled", false);
}

function logoutSf () {
    ons.notification.confirm(
            {
                message: "This will log you out of Salesforce. Are you sure?", 
                buttonLabels:["Logout","Cancel"]
            }
        ).then(function(confirmStatus) {
            if(confirmStatus === 0) {
                force.logout();
            }
        });
}

function lockScreen() {
    loggedInContact = {};
    document.querySelector('#userInfo').hide();
    document.querySelector('#modal').show();
    document.querySelector("#username").innerHTML = '';
    document.querySelector("#username-subtitle").innerHTML = '';
}

function unlockScreen() {
    document.querySelector('#modal').hide();
}

function showUserInfo () {
    document.querySelector('#userInfo').show();
}

function hideUserInfo () {
    document.querySelector('#userInfo').hide();
}

function verifyUser() {
    var passCode = document.querySelector("#passCode").value;
    var locEl = document.querySelector('#locationList');
    selectedLocation = locEl.options[locEl.selectedIndex].value;
    console.log(selectedLocation);
    if(passCode && passCode.length >0 ) {
        fetchRecords(function (data) {
            if(data.records && data.records.length >= 1) {
                document.querySelector("#username").innerHTML = data.records[0].Name;
                document.querySelector("#username-subtitle").innerHTML = data.records[0].Name;
                document.querySelector("#passCode").value = '';
                loggedInContact = data.records[0];
                unlockScreen();
            }else {
                alert('Invalid Passcode');
                //ons.notification.alert('Invalid Passcode');
            }
        },
        "SELECT Id, Name FROM Contact WHERE Pass_Code__c = '"+passCode+"' LIMIT 1"
    );
    }else {
        alert('Please enter your passcode');
        //ons.notification.alert('Please enter your passcode');
    }
}

function refreshData () {
    showShipmentList("SELECT Id, Name,Status__c,Type__c,Expected_Availability_date__c,Shipped_Datetime__c,From_Location__r.Name,To_Location__r.Name,Carrier__r.Name, Carrier__c,Shipping_Trailer_Id__c FROM Shipment__c WHERE Status__c = 'Yet to start' OR Status__c = 'In Progress' ORDER BY lastmodifieddate DESC LIMIT 20", '#shipmentList');
    //Not loading receive list as per latest request
    //showReceivedShipmentList("SELECT Id, Name,Status__c,Type__c,Expected_Availability_date__c,Shipped_Datetime__c,From_Location__r.Name,To_Location__r.Name,Carrier__r.Name,Carrier__c,Shipping_Trailer_Id__c FROM Shipment__c WHERE Status__c = 'Shipped' ORDER BY lastmodifieddate DESC LIMIT 20", '#receiveShipmentList');
    showTransferShipmentList("SELECT Id, Name,Status__c,Type__c,Expected_Availability_date__c,Shipped_Datetime__c,From_Location__r.Name,To_Location__r.Name,Carrier__r.Name,Carrier__c,Shipping_Trailer_Id__c FROM Shipment__c WHERE Type__c = 'Transfer between warehouses' ORDER BY lastmodifieddate DESC LIMIT 20", '#transferList');
}

if(!window.cordova){
    onDeviceReady();
}
setSearchBinding();
/************************************************************
 * UI Manipulation methods
 ************************************************************/
/* This method will render a list of shipments from current salesforce org */
var showShipmentList = function (query, renderTarget) {
    fetchRecords(function (data) {
        //renderOpenShipments(data.records, renderTarget);
        renderShipmentList(data.records, 'ship');
        },
        query
    );
};

var showReceivedShipmentList = function (query, renderTarget) {
    fetchRecords(function (data) {
        //renderReceiveShipments(data.records, renderTarget);
        renderShipmentList(data.records, 'receive');
        },
        query
    );
};

var showTransferShipmentList = function(query, renderTarget) {
    fetchRecords(function (data) {
        //renderTransferShipments(data.records, renderTarget);
        renderShipmentList(data.records, 'transfer');
        },
        query
    )
}

//Method to format date
function formatDate (dateVal) {
    if(!dateVal) {
        return '';
    }
    var newVal = '';
    if(dateVal.length >= 16){
		newVal = dateVal.substring(5, 7)+'/'+dateVal.substring(8, 10)+'/'+dateVal.substring(0, 4)+' - ';
        var hourVal = parseInt(dateVal.substring(11,13));
        var ampmString = 'AM';
        if(hourVal > 12) {
            hourVal = hourVal - 12;
            ampmString = 'PM';
        }
        if(hourVal == 12) {
            ampmString = 'PM';
        }
        var hrString = (hourVal < 10 ? '0'+hourVal.toString() : hourVal.toString());
        newVal += hrString+':'+dateVal.substring(14, 16)+' '+ampmString;
    }
    return newVal;
}

function showSearchResults(oppList) {
    cacheSearchResult = oppList;
    var resultHtml = '<ul class="list list--material">';
    if(oppList.length == 0) {
        resultHtml += '<li class="search-error">No matching results found</ul>';
    }else {
        //Account.Name, Show_Name__r.Name, Booth__c, Event_Opening_Day__c, Account_Manager__c, Project_Manager__r.Name
        for (var i = 0; i < oppList.length; i++) {

            resultHtml += '<li class="list__item list__item--material opp-item">'+                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                            '<div class="list__item__center list__item--material__center" '+
                                    'data-sfid="'+oppList[i].Id+'">'+
                                '<div class="list__item__title list__item--material__title" '+
                                    'data-sfid="'+oppList[i].Id+'">'
                                    +oppList[i].MAS__c+' - '+oppList[i].Name+
                                '</div>'+
                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                    'data-sfid="'+oppList[i].Id+'">'+
                                    (oppList[i].AccountId ? oppList[i].Account.Name+'<br/>' : '')+
                                    (oppList[i].Show_Name__c ? oppList[i].Show_Name__r.Name+'<br/>' : '')+
                                    (oppList[i].Booth__c ? oppList[i].Booth__c+'<br/>' : '')+
                                    (oppList[i].Event_Opening_Day__c ? oppList[i].Event_Opening_Day__c+'<br/>': '')+
                                    (oppList[i].Account_Manager__c ? oppList[i].Account_Manager__c+'<br/>': '')+
                                    (oppList[i].Project_Manager__c ? oppList[i].Project_Manager__r.Name : '')+
                                '</div>'+
                            '</div>'+
                            '</li>';
                // Child shipments
                resultHtml += '<ul class="list list--material sub-list">';
                    if(oppList[i].Shipments__r && oppList[i].Shipments__r.records) {
                        var childList = oppList[i].Shipments__r.records;
                        for(var j=0; j<childList.length; j++) {
                            console.log(childList[j]);
                            resultHtml += '<li class="list__item list__item--material opp-ship-item">'+
                                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                                            '<div class="list__item__center list__item--material__center" '+
                                                    'data-sfid="'+childList[j].Id+'">'+
                                                '<div class="list__item__title list__item--material__title" '+
                                                    'data-sfid="'+childList[j].Id+'">'+
                                                    childList[j].Name+' ('+childList[j].Status__c+')'+
                                                '</div>'+
                                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                                    'data-sfid="'+childList[j].Id+'">'+
                                                    childList[j].Type__c+'<br/>'+
                                                    (childList[j].To_Location__c ? childList[j].To_Location__r.Name+'<br/>' : '')+  
                                                    formatDate(childList[j].Shipped_Datetime__c)+
                                                '</div>'+
                                            '</div>'+
                                            '</li>';
                        }
                    }
               resultHtml += '</ul>'; 
        }
    }
    resultHtml += '</ul>';
    document.querySelector('#searchResultBox').innerHTML = resultHtml;
    document.querySelectorAll('.opp-item').forEach(function(element) {
        element.addEventListener(eventType,showOppDetails, false);
    });
    document.querySelectorAll('.opp-ship-item').forEach(function(element) {
        element.addEventListener(eventType,showShipmentDetails, false);
    });
}

function renderOpenShipments(shipments, renderTarget) {
    console.log(renderTarget);
    cacheShipmentList = shipments;
    var listItemsHtml = '';
    for (var i = 0; i < shipments.length; i++) {
        listItemsHtml += '<li class="list__item list__item--material ship-item">'+
                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                            '<div class="list__item__center list__item--material__center" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                '<div class="list__item__title list__item--material__title" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Name+' ('+shipments[i].Status__c+')'+
                                '</div>'+
                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Type__c+
                                '</div>'+
                            '</div>'+
                            '</li>';
    }
    hideShipmentLoading();
    document.querySelector(renderTarget).innerHTML = listItemsHtml;
    var itemElArray = document.querySelectorAll ('.ship-item');
    itemElArray.forEach(function(element) {
        element.addEventListener(eventType,showShipmentDetails, false);
    });
}

function renderReceiveShipments(shipments, renderTarget) {
    console.log(renderTarget,' ==> ',shipments);
    cacheReceiveList = shipments;
    var listItemsHtml = '';
    for (var i = 0; i < shipments.length; i++) {
        listItemsHtml += '<li class="list__item list__item--material receive-ship-item">'+
                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                            '<div class="list__item__center list__item--material__center" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                '<div class="list__item__title list__item--material__title" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Name+' ('+shipments[i].Status__c+')'+
                                '</div>'+
                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Type__c+
                                '</div>'+
                            '</div>'+
                            '</li>';
    }
    document.querySelector(renderTarget).innerHTML = listItemsHtml;
    var itemElArray = document.querySelectorAll ('.receive-ship-item');
    itemElArray.forEach(function(element) {
        element.addEventListener(eventType,showReceiveShipmentDetails, false);
    });
}

function renderTransferShipments (shipments, renderTarget) {
    console.log(renderTarget,' ==> ',shipments);
    cacheTransferList = shipments;
    var listItemsHtml = '';
    for (var i = 0; i < shipments.length; i++) {
        listItemsHtml += '<li class="list__item list__item--material transfer-ship-item">'+
                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                            '<div class="list__item__center list__item--material__center" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                '<div class="list__item__title list__item--material__title" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Name+' ('+shipments[i].Status__c+')'+
                                '</div>'+
                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                    'data-sfid="'+shipments[i].Id+'">'+
                                    shipments[i].Type__c+
                                '</div>'+
                            '</div>'+
                            '</li>';
    }
    document.querySelector(renderTarget).innerHTML = listItemsHtml;
    var itemElArray = document.querySelectorAll ('.transfer-ship-item');
    itemElArray.forEach(function(element) {
        element.addEventListener(eventType,showShipmentDetails, false);
    });
}

//Rendering list of shipments
function renderShipmentList (shipments, type) {
    var renderTarget, highlightClass;
    if(type === 'ship') {
        renderTarget = '#shipmentList';
        highlightClass = 'ship-item';
        cacheShipmentList = shipments;
    }else if(type === 'receive') {
        renderTarget = '#receiveShipmentList';
        highlightClass = 'receive-ship-item';
        cacheReceiveList = shipments;
    }else if(type === 'transfer') {
        renderTarget = '#transferList';
        highlightClass = 'transfer-ship-item';
        cacheTransferList = shipments;
    }
    console.log('Rendering '+type+' shipments on '+renderTarget,' ==> ',shipments);
    var listItemsHtml = '';
    for (var i = 0; i < shipments.length; i++) {
        console.log(shipments[i].Status__c);
        listItemsHtml += '<li class="list__item list__item--material '+highlightClass+'">'+
                            '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                            '<div class="list__item__center list__item--material__center" '+
                                    'data-sfid="'+shipments[i].Id+'" data-type="'+type+'">'+
                                '<div class="list__item__title list__item--material__title" '+
                                    'data-sfid="'+shipments[i].Id+'" data-type="'+type+'">'+
                                    shipments[i].Name+' ('+shipments[i].Status__c+')'+
                                '</div>'+
                                '<div class="list__item__subtitle list__item--material__subtitle" '+
                                    'data-sfid="'+shipments[i].Id+'" data-type="'+type+'">'+
                                    shipments[i].Type__c+
                                '</div>'+
                            '</div>'+
                            '</li>';
    }
    document.querySelector(renderTarget).innerHTML = listItemsHtml;
    var itemElArray = document.querySelectorAll ('.'+highlightClass);
    itemElArray.forEach(function(element) {
        element.addEventListener(eventType,showShipmentDetails, false);
    });
    hideShipmentLoading();
}

function setScanBinding (funcName) {
    setTimeout(function() {
        var btn = document.querySelector('#scanButton');
        btn.addEventListener(eventType, funcName, false);
        //var shipButton = document.querySelector('#scanButton');
    }, 300);
}

function showAssetContainers (parentId, type) {
    var parentStatus = highlightShipment.Status__c;
    var isShipment = (type === 'ship' || ((!type || type === 'transfer') && (parentStatus === 'Yet to start' || parentStatus === 'In Progress')));
    console.log(isShipment,type, parentStatus);
    // if(isShipment){
    //     setScanBinding(scanAsset);
    // }else {
    //     setScanBinding(receiveAsset);
    // }
    fetchRecords(function (data) {
        var assetContainers = data.records;
        cacheShipContainerList = data.records;
        console.log(cacheShipContainerList);
        // if(isShipment){
        //     document.querySelector('#gil-assets').innerHTML = generateShipListHtml(assetContainers);
        //     document.querySelectorAll ('.gil-delete').forEach(function(element) {
        //                                                 element.addEventListener(eventType,deleteShipmentContainer, false);
        //                                             });
        //     document.querySelectorAll ('.gil-ship').forEach(function(element) {
        //                                                     element.addEventListener(eventType,startVerification, false);
        //                                                 });
        // }else {
        //     console.log('called');
        //     document.querySelector('#gil-assets').innerHTML = generateReceiveListHtml(assetContainers);
        //     document.querySelectorAll ('.gil-receive').forEach(function(element) {
        //                                                 element.addEventListener(eventType,startReceiving, false);
        //                                             });
        // }
        if(assetContainers.length == 0) {
            document.querySelector('#gil-assets').innerHTML = generateEmptyListHtml();
        } else {
            document.querySelector('#gil-assets').innerHTML = generateUniversalListHtml(assetContainers, isShipment);
            document.querySelectorAll ('.gil-delete').forEach(function(element) {
                                                        element.addEventListener(eventType,deleteShipmentContainer, false);
                                                    });
            document.querySelectorAll ('.gil-ship').forEach(function(element) {
                                                            element.addEventListener(eventType,startVerification, false);
                                                        });
            document.querySelectorAll ('.gil-receive').forEach(function(element) {
                                                        element.addEventListener(eventType,startReceiving, false);
                                                    });
        }
    },
    "SELECT Id, Name, Load_Datetime__c, Received_Datetime__c, Asset_Container__r.Name, Asset_Container__r.Barcode__c FROM Shipment_Container__c WHERE Shipment__c = '"+parentId+"' ORDER BY lastmodifieddate DESC"
    )
}

function generateEmptyListHtml() {
    return '<ons-list-item modifier="material divider">'+
                '<div class="list__item__center">'+
                    'Asset Containers'+
                '</div>'+
            '</ons-list-item>'+
            '<ons-list-item modifier="material">'+
                '<div class="list__item__center">'+
                    '<span class="list__item__title">'+
                        'There are no Asset Containers'+
                    '</span>'+
                '</ons-list-item>';
}

function generateShipListHtml(assetContainers) {
    var listItemsHtml = '<ons-list-item modifier="material divider">'+
                                '<div class="list__item__center">'+
                                    'Asset Containers'+
                                '</div>'+
                            '</ons-list-item>';
        for (var i = 0; i < assetContainers.length; i++) {
            listItemsHtml += '<ons-list-item modifier="material">'+
                                '<div class="list__item__center">'+
                                    '<span class="list__item__title">'+
                                        assetContainers[i].Asset_Container__r.Name +
                                    '</span>'+
                                    '<span class="list__item__subtitle">'+
                                         'Barcode - '+assetContainers[i].Asset_Container__r.Barcode__c+
                                         '<br/>'+
                                         (assetContainers[i].Load_Datetime__c ? 
                                            '<ons-icon icon="fa-truck" style="color: green;" size="15px" class="list__item__icon"></ons-icon>'+formatDate(assetContainers[i].Load_Datetime__c):
                                             '')+
                                    '</span>'+
                                '</div>'+
                                '<div class="list__item__right">'+
                                    (assetContainers[i].Load_Datetime__c ? 
                                        '<ons-icon icon="fa-truck" data-barcode="'+assetContainers[i].Asset_Container__r.Barcode__c+'" data-timestamp="'+assetContainers[i].Load_Datetime__c+'" data-sfid="'+assetContainers[i].Id+'" style="color: green;" size="38px" class="list__item__icon gil-ship"></ons-icon>': 
                                        '<ons-icon icon="fa-truck" data-barcode="'+assetContainers[i].Asset_Container__r.Barcode__c+'" data-timestamp="'+assetContainers[i].Load_Datetime__c+'" data-sfid="'+assetContainers[i].Id+'" style="color: grey;" size="38px" class="list__item__icon gil-ship"></ons-icon>' ) +
                                    '<ons-icon icon="fa-trash-o" data-sfid="'+assetContainers[i].Id+'" style="color: red;" size="38px" class="list__item__icon gil-delete"></ons-icon>'+
                                '</div>'+
                              '</ons-list-item>';
        }
    return listItemsHtml;
}

function generateReceiveListHtml(assetContainers) {
    var listItemsHtml = '<ons-list-item modifier="material divider">'+
                                '<div class="list__item__center">'+
                                    'Asset Containers'+
                                '</div>'+
                            '</ons-list-item>';
        for (var i = 0; i < assetContainers.length; i++) {
            listItemsHtml += '<ons-list-item modifier="material">'+
                                '<div class="list__item__center">'+
                                    '<span class="list__item__title">'+
                                        assetContainers[i].Asset_Container__r.Name +
                                    '</span>'+
                                    '<span class="list__item__subtitle">'+
                                         'Barcode - '+assetContainers[i].Asset_Container__r.Barcode__c+
                                         '<br/>'+
                                         (assetContainers[i].Load_Datetime__c ? 
                                          '<ons-icon icon="fa-truck" style="color: green;" size="15px" class="list__item__icon"></ons-icon>'+formatDate(assetContainers[i].Load_Datetime__c):
                                          '' )+
                                         '<br/>'+
                                         (assetContainers[i].Received_Datetime__c ? 
                                          '<ons-icon icon="fa-check-circle-o" style="color: green;" size="15px" class="list__item__icon"></ons-icon>'+formatDate(assetContainers[i].Received_Datetime__c) :
                                          '' )+
                                    '</span>'+
                                '</div>'+
                                '<div class="list__item__right">'+
                                    (assetContainers[i].Received_Datetime__c ? 
                                        '<ons-icon icon="fa-check-circle-o" data-barcode="'+assetContainers[i].Asset_Container__r.Barcode__c+'" data-timestamp="'+assetContainers[i].Received_Datetime__c+'" data-sfid="'+assetContainers[i].Id+'" style="color: green;" size="40px" class="list__item__icon gil-receive"></ons-icon>': 
                                        '<ons-icon icon="fa-check-circle-o" data-barcode="'+assetContainers[i].Asset_Container__r.Barcode__c+'" data-timestamp="'+assetContainers[i].Received_Datetime__c+'" data-sfid="'+assetContainers[i].Id+'" style="color: grey;" size="40px" class="list__item__icon gil-receive"></ons-icon>') +
                                '</div>'+
                              '</ons-list-item>';
        }
    return listItemsHtml;
}

function generateUniversalListHtml(assetContainers, isShipment) {
    var listItemsHtml = '<ons-list-item modifier="material divider">'+
                                '<div class="list__item__center">'+
                                    'Asset Containers'+
                                '</div>'+
                            '</ons-list-item>';
        for (var i = 0; i < assetContainers.length; i++) {
            listItemsHtml += generateIndividualItem(assetContainers[i], isShipment);
        }
    return listItemsHtml;
}

function generateIndividualItem(container, isShipment) {
    return '<ons-list-item modifier="material">'+
                                '<div class="list__item__center">'+
                                    '<span class="list__item__title">'+
                                        container.Asset_Container__r.Name +
                                    '</span>'+
                                    '<span class="list__item__subtitle">'+
                                         'Barcode - '+container.Asset_Container__r.Barcode__c+
                                         '<br/>'+
                                         (container.Load_Datetime__c ? 
                                          '<ons-icon icon="fa-truck" style="color: green;" size="15px" class="list__item__icon"></ons-icon>'+
                                          formatDate(container.Load_Datetime__c)+'<br/>':
                                          '' )+
                                         (container.Received_Datetime__c ? 
                                          '<ons-icon icon="fa-check-circle-o" style="color: green;" size="15px" class="list__item__icon"></ons-icon>'+
                                            formatDate(container.Received_Datetime__c) :
                                          '' )+
                                    '</span>'+
                                '</div>'+
                                '<div class="list__item__right">'+
                                    (isShipment ? 
                                        (container.Load_Datetime__c ? 
                                            '<ons-icon icon="fa-truck" data-barcode="'+container.Asset_Container__r.Barcode__c+'" data-timestamp="'+container.Load_Datetime__c+'" data-sfid="'+container.Id+'" style="color: green;" size="38px" class="list__item__icon gil-ship"></ons-icon>': 
                                            '<ons-icon icon="fa-truck" data-barcode="'+container.Asset_Container__r.Barcode__c+'" data-timestamp="'+container.Load_Datetime__c+'" data-sfid="'+container.Id+'" style="color: grey;" size="38px" class="list__item__icon gil-ship"></ons-icon>' ) +
                                        '<ons-icon icon="fa-trash-o" data-sfid="'+container.Id+'" style="color: red;" size="38px" class="list__item__icon gil-delete"></ons-icon>'
                                        :
                                        (container.Received_Datetime__c ? 
                                        '<ons-icon icon="fa-check-circle-o" data-barcode="'+container.Asset_Container__r.Barcode__c+'" data-timestamp="'+container.Received_Datetime__c+'" data-sfid="'+container.Id+'" style="color: green;" size="40px" class="list__item__icon gil-receive"></ons-icon>': 
                                        '<ons-icon icon="fa-check-circle-o" data-barcode="'+container.Asset_Container__r.Barcode__c+'" data-timestamp="'+container.Received_Datetime__c+'" data-sfid="'+container.Id+'" style="color: grey;" size="40px" class="list__item__icon gil-receive"></ons-icon>')
                                    )+
                                '</div>'+
                              '</ons-list-item>';
}

function showShipmentDetails (event) {
    highlightShipmentId = event.target.dataset.sfid;
    var type = event.target.dataset.type;
    console.log("Details of ID => "+highlightShipmentId +' and type =>'+type);
    var foundMatch = false;
    if(type === 'ship') {
        cacheShipmentList.forEach(function(shipment) {
            if(shipment.Id === highlightShipmentId){
                highlightShipment = shipment;
                foundMatch = true;
            }
        });
    }else if(type === 'receive') {
        cacheReceiveList.forEach(function(shipment) {
            if(shipment.Id === highlightShipmentId){
                highlightShipment = shipment;
                foundMatch = true;
            }
        });
    }else if(type === 'transfer') {
        cacheTransferList.forEach(function(shipment) {
            if(shipment.Id === highlightShipmentId){
                highlightShipment = shipment;
                foundMatch = true;
            }
        });
    }
    if(!foundMatch && cacheSearchResult.length > 0) {
        //Checking if match exists under first Opportunity
        var searchShipList = ( cacheSearchResult[0].Shipments__r && cacheSearchResult[0].Shipments__r.records ? 
                               cacheSearchResult[0].Shipments__r.records : []);
        searchShipList.forEach(function(shipment) {
            if(shipment.Id === highlightShipmentId){
                highlightShipment = shipment;
                foundMatch = true;
            }
        });
    }
    if(!foundMatch && cacheShipSearchResult.length >0 ) {
        cacheShipSearchResult.forEach(function(shipment) {
            if(shipment.Id === highlightShipmentId){
                highlightShipment = shipment;
                foundMatch = true;
            }
        });
    }
    console.log('Match',highlightShipment);
    myNavigator.pushPage("shipmentDetails.html", {data : highlightShipment})
                .then(showAssetContainers(highlightShipmentId, type));
}

function showOppDetails (event) {
    highlightOppId = event.target.dataset.sfid;
    console.log("calling details of Opportunity => "+highlightOppId);
    cacheSearchResult.forEach(function(opp) {
        if(opp.Id === highlightOppId){
            highlightOpp = opp;
        }
    });
    myNavigator.pushPage("oppDetails.html", {data : highlightOpp});
                //.then(showAssetContainers(highlightOppId, '#gil-assets'));
}

function showReceiveShipmentDetails (event) {
    highlightShipmentId = event.target.dataset.sfid;
    console.log("calling details of shipment => "+highlightShipmentId);
    cacheReceiveList.forEach(function(shipment) {
        if(shipment.Id === highlightShipmentId){
            highlightShipment = shipment;
        }
    });
    myNavigator.pushPage("receiveShipment.html", {data : highlightShipment})
                .then(showAssetContainers(highlightShipmentId, 'receive'));
}

function showSearchPage () {
    myNavigator.pushPage("searchResults.html");
               //.then(setSearchBinding());
    
}

function setSearchBinding () {
    setTimeout(function() {
        document.querySelector('#searchInput').addEventListener('keyup', searchSf);
    }, 500);
}
function searchSf (event) {
    if(event.keyCode == 13){
        console.log(event.target.value);
        var searchOppKey = event.target.value;
        if(!searchOppKey) {
            //alert("Please enter MAS Job # or Shipment ID");
            ons.notification.alert("Please enter MAS Job # or Shipment ID");
            return;
        }
        var shipWhereClause = '';
        if(searchOppKey && searchOppKey.indexOf('-') != -1) {
            shipWhereClause = " WHERE Shipment_ID__c LIKE '"+searchOppKey+"%'";
            searchOppKey = searchOppKey.split('-')[0];
        }
        fetchRecords(function (data) {
                showSearchResults(data.records);
            },
            "SELECT Id, Name, AccountId, Account.Name, Show_Name__c, Show_Name__r.Name,Show_Name__r.Location__c,Show_Name__r.Location__r.Name, Booth__c, "+
                "Event_Opening_Day__c, Account_Manager__c, Project_Manager__c, Project_Manager__r.Name, MAS__c, Shipping_to_Advance_Warehouse__c, "+
                "Show_Name__r.Advance_Warehouse__c, Show_Name__r.Advance_Warehouse__r.Name, "+
                "(SELECT Id, Name,Status__c,Type__c,Expected_Availability_date__c,Shipped_Datetime__c,"+
                    "From_Location__c,From_Location__r.Name,To_Location__c, To_Location__r.Name,Carrier__r.Name, Carrier__c,Shipping_Trailer_Id__c FROM Shipments__r "+shipWhereClause+" ORDER BY lastmodifieddate DESC) "+
                "FROM Opportunity WHERE MAS__c = '"+searchOppKey+"'"
        );
    }
}

function setOnloadBindings(){
    document.querySelector('#shipmentPlus').addEventListener(eventType, openNewShipment, false);
    //document.querySelector('#shipmentPlus').addEventListener("click", scanBarcode, false);
}

function hideShipmentLoading(){
    document.querySelector('#shipmentsLoading').style.display = "none";
}

var showDialog = function(id) {
  document.getElementById(id).show();
};

var hideDialog = function(id) {
  document.getElementById(id).hide();
};

/************************************************************
 * Event handlers
 ************************************************************/
// Handing onload events
document.addEventListener("init", function(event) {
  var focusPage = event.target;
  console.log("New Page ID => "+focusPage.id);
  if(focusPage.id === "shipmentDetails"){
      focusPage.querySelector('ons-toolbar .gil-title').innerHTML = focusPage.data.Name+' ('+focusPage.data.Status__c+')';
      focusPage.querySelector('.gil-type').innerHTML = focusPage.data.Type__c;
      var moreHtml = 'Ship Date : '+formatDate(focusPage.data.Shipped_Datetime__c)+'<br/>'+
                     'Carrier : '+(focusPage.data.Carrier__c ?focusPage.data.Carrier__r.Name:'')+'<br/>'+
                     'Trailer ID : '+(focusPage.data.Shipping_Trailer_Id__c?focusPage.data.Shipping_Trailer_Id__c:'')+'<br/>'+
                     'From Location : '+ ((focusPage.data.From_Location__r && focusPage.data.From_Location__r.Name) ? focusPage.data.From_Location__r.Name : '') +'<br/>'+
                     'To Location : '+ ((focusPage.data.To_Location__r && focusPage.data.To_Location__r.Name) ? focusPage.data.To_Location__r.Name : '');
      focusPage.querySelector('.gil-moreInfo').innerHTML = moreHtml;
      var isShipment = (focusPage.data.Status__c === 'Yet to start' || focusPage.data.Status__c === 'In Progress');
      if(isShipment) {
          focusPage.querySelector('#scanButton').addEventListener(eventType, scanAsset, false);
          focusPage.querySelector('#scan-btn-text').innerHTML = 'Ship It';
          var shipBtn = focusPage.querySelector('#ship-receive-btn');
          shipBtn.dataset.status = 'Shipped';
          shipBtn.addEventListener(eventType, updateShipmentStatus, false);
      }else {
          focusPage.querySelector('#scanButton').addEventListener(eventType, receiveAsset, false);
          focusPage.querySelector('#scan-btn-text').innerHTML = 'Received';
          focusPage.querySelector('#ship-receive-btn').dataset.status = 'Received';
          var shipBtn = focusPage.querySelector('#ship-receive-btn');
          shipBtn.dataset.status = 'Received';
          shipBtn.addEventListener(eventType, updateShipmentStatus, false);
      }
  }else if(focusPage.id === "newShipment"){
      console.log(cacheParentOpp);
      if(cacheParentOpp.Id) {
          focusPage.querySelector(".opp-parent").style.display = 'block';
          focusPage.querySelector(".type-parent").style.display = 'none';
          focusPage.querySelector(".parent-opp-info").innerHTML = '<strong>'+cacheParentOpp.MAS__c+'</strong>';
          focusPage.querySelector("#new-title").innerHTML = 'New Shipment';
          focusPage.querySelector("#trailerParent").style.display = 'block';
      }else {
          focusPage.querySelector(".opp-parent").style.display = 'none';
          focusPage.querySelector(".type-parent").style.display = 'none';
          focusPage.querySelector("#new-title").innerHTML = 'New Transfer';
          focusPage.querySelector("#trailerParent").style.display = 'none';
      }
      var fromLocationHtml = '';
      var toLocationHtml = '';
      var gilbertLocationHtml = '';
      console.log(cacheParentOpp.AccountId, 'parent account id');
      //If creating shipment under an opportunity, ie non-transfer ones
      if(cacheParentOpp.Id) {
        if(cacheParentOpp.Shipping_to_Advance_Warehouse__c === 'No' && cacheParentOpp.Show_Name__c && cacheParentOpp.Show_Name__r.Location__c && cacheParentOpp.Show_Name__r.Location__r.Name) {
            toLocationHtml += '<option value="'+cacheParentOpp.Show_Name__r.Location__c+'" selected>'+cacheParentOpp.Show_Name__r.Location__r.Name+'</option>';
        }else if(cacheParentOpp.Shipping_to_Advance_Warehouse__c === 'Yes' && cacheParentOpp.Show_Name__c && cacheParentOpp.Show_Name__r.Advance_Warehouse__c && cacheParentOpp.Show_Name__r.Advance_Warehouse__r.Name) {
            toLocationHtml += '<option value="'+cacheParentOpp.Show_Name__r.Shipping_to_Advance_Warehouse__c+'" selected>'+cacheParentOpp.Show_Name__r.Shipping_to_Advance_Warehouse__r.Name+'</option>';
        }
        appendChildLocations(focusPage,cacheParentOpp.AccountId);
      }
      cacheLocationList.forEach(function(loc) {
          gilbertLocationHtml += '<option value="'+loc.Id+'">'+loc.Name+'</option>';
          fromLocationHtml += '<option value="'+loc.Id+'" '+( loc.Id === selectedLocation ? 'selected="selected"': '')+'>'+loc.Name+'</option>';
      });
      var carrierHtml = '';
      cacheCarriorList.forEach(function(carrier) {
          carrierHtml += '<option value="'+carrier.Id+'">'+carrier.Name+'</option>';
      });
      focusPage.querySelector('#carrier').innerHTML = carrierHtml;
      focusPage.querySelector('#fromLocation').innerHTML = fromLocationHtml;
      focusPage.querySelector('#toLocation').innerHTML = toLocationHtml+gilbertLocationHtml;
  }else if(focusPage.id === "receiveShipment"){
      console.log(highlightShipment);
      focusPage.querySelector('ons-toolbar .gil-receive-title').innerHTML = highlightShipment.Name+'('+highlightShipment.Status__c+')';
      focusPage.querySelector('.gil-receive-type').innerHTML = highlightShipment.Type__c;
      var moreHtml = 'Ship Date : '+formatDate(highlightShipment.Shipped_Datetime__c)+'<br/>'+
                     'Expected Availability Date : '+(highlightShipment.Expected_Availability_date__c?highlightShipment.Expected_Availability_date__c:'')+'<br/>'+
                     'From Location : '+ ((highlightShipment.From_Location__r && highlightShipment.From_Location__r.Name) ? highlightShipment.From_Location__r.Name : '') +'<br/>'+
                     'To Location : '+ ((highlightShipment.To_Location__r && highlightShipment.To_Location__r.Name) ? highlightShipment.To_Location__r.Name : '');
      focusPage.querySelector('.gil-receive-moreInfo').innerHTML = moreHtml;
  }else if(focusPage.id === 'oppDetails') {
      console.log(highlightOpp);
      document.querySelector('#oppShipmentPlus').addEventListener(eventType, openNewOppShipment, false);
      focusPage.querySelector(".gil-opp-name").innerHTML = highlightOpp.Name;
      focusPage.querySelector(".gil-opp-title").innerHTML = highlightOpp.Name;
      var moreHtml = 'Account Name : '+ (highlightOpp.AccountId ? highlightOpp.Account.Name : '')+'<br/>'+
                    'Show Name : '+ (highlightOpp.Show_Name__c ? highlightOpp.Show_Name__r.Name : '')+'<br/>'+
                    'Booth # : '+ (highlightOpp.Booth__c ? highlightOpp.Booth__c : '')+'<br/>'+
                    'Opening Day : '+ (highlightOpp.Event_Opening_Day__c ? highlightOpp.Event_Opening_Day__c: '')+'<br/>'+
                    'Account Manager : '+ (highlightOpp.Account_Manager__c ? highlightOpp.Account_Manager__c: '')+'<br/>'+
                    'Project Manager : '+ (highlightOpp.Project_Manager__c ? highlightOpp.Project_Manager__r.Name : '');                                    
      focusPage.querySelector(".gil-opp-moreInfo").innerHTML = moreHtml;
      var listItemsHtml = '<ons-list-item modifier="material">'+
                                '<div class="list__item__center">'+
                                    'Shipments'+
                                '</div>'+
                            '</ons-list-item>';
        if(highlightOpp.Shipments__r && highlightOpp.Shipments__r.records && highlightOpp.Shipments__r.records.length > 0) {
            for (var i = 0; i < highlightOpp.Shipments__r.records.length; i++) {
                //'<div class="list__item__center" data-sfid="'+highlightOpp.Shipments__r.records[i].Id+'">'+
                listItemsHtml += '<ons-list-item class="opp-ship-item" data-sfid="'+highlightOpp.Shipments__r.records[i].Id+'">'+
                                    '<ons-ripple color="rgba(0, 0, 0, 0.1)"></ons-ripple>'+
                                        '<span class="list__item__title" data-sfid="'+highlightOpp.Shipments__r.records[i].Id+'">'+
                                            highlightOpp.Shipments__r.records[i].Name +'('+highlightOpp.Shipments__r.records[i].Status__c+')'+
                                        '</span>'+
                                        '<span class="list__item__subtitle" data-sfid="'+highlightOpp.Shipments__r.records[i].Id+'">'+
                                            highlightOpp.Shipments__r.records[i].Type__c+'<br/>'+
                                            (highlightOpp.Shipments__r.records[i].To_Location__c ? highlightOpp.Shipments__r.records[i].To_Location__r.Name+'<br/>' : '')+  
                                            formatDate(highlightOpp.Shipments__r.records[i].Shipped_Datetime__c)+
                                        '</span>'+
                                '</ons-list-item>';
            }
        }else {
            listItemsHtml += '<p> There are no shipments under this opportunity. You can create one by using Plus icon below</p>';
        }
        focusPage.querySelector("#gil-opp-shipments").innerHTML = listItemsHtml;
        document.querySelectorAll('.opp-ship-item').forEach(function(element) {
            element.addEventListener(eventType,showShipmentDetails, false);
        });
  }

});

function appendChildLocations (focusPage, accountId) {
    fetchRecords(function(childLocs) {
        console.log(childLocs);
        var locHtml = '';
        childLocs.records.forEach(function(loc) {
            locHtml += '<option value="'+loc.Id+'">'+loc.Name+'</option>';
        });
        focusPage.querySelector('#fromLocation').innerHTML = focusPage.querySelector('#fromLocation').innerHTML+locHtml;
        focusPage.querySelector('#toLocation').innerHTML = focusPage.querySelector('#toLocation').innerHTML+locHtml;
    },
    "SELECT Id, Name FROM Location__c WHERE Account__c = '"+accountId+"'"
    );
}

/************************************************************
 * Salesforce interaction methods
 ************************************************************/

/* This method will fetch a list of records from Salesforce. */
var fetchRecords = function (successHandler, soql) {
    force.query(soql, successHandler, function (error) {
        console.log(error);
        console.log('Failed to fetch data: ' + error);
        ons.notification.alert("Failed to fetch data");
    });
};

var createRecord = function(objName, data, successHandler) {
    force.create(objName, data, successHandler, function(error) {
        console.log(error);
        ons.notification.alert('Failed to create record');
    });
}

var updateRecord = function(objName, data, successHandler) {
    force.update(objName, data, successHandler, function(error) {
        console.log(error);
        ons.notification.alert('Failed to update record');
    });
}

var deleteRecord = function(objName, recordId, successHandler) {
    force.del(objName, recordId, successHandler, function(error) {
        console.log(error);
        ons.notification.alert('Failed to delete record');
    });
}

function updateShipmentStatus (event) {
    var status = event.target.dataset.status;
    ons.notification.confirm(
            {
                message: "This will close the shipment and mark it as ‘"+status+"’. This action cannot be undone. Proceed?", 
                buttonLabels:["Proceed","Cancel"]
            }
        ).then(function(confirmStatus) {
            if(confirmStatus === 0) {
                continueStatusUpdate(status);
            }
        });
}

function continueStatusUpdate (status) {
    var shipment = {};
        shipment.Id = highlightShipmentId;
        shipment.Status__c = status;
    if(status === 'Shipped'){
        if(cacheShipContainerList.length == 0) {
            ons.notification.alert('Please add at least one asset before you ship this shipment');
            return null;
        }
        var isAllLoaded = true;
        cacheShipContainerList.forEach(function(shipItem) {
            if(!shipItem.Load_Datetime__c) {
                isAllLoaded = false;
            }
        });
        if(!isAllLoaded) {
            ons.notification.alert('Please load all assets before you ship this shipment.');
            return null;
        }
        shipment.Shipped_Datetime__c = new Date();
        updateRecord('Shipment__c', shipment, function(updateResponse) {
            console.log(updateResponse);
        });
        cacheShipmentList = cacheShipmentList.filter(function(ship) {
            return ship.Id != highlightShipmentId;
        });
        //renderOpenShipments(cacheShipmentList, '#shipmentList');
        renderShipmentList(cacheShipmentList, 'ship');
    }else if (status === 'Received'){
        var isAllReceived = true;
        cacheShipContainerList.forEach(function(shipItem) {
            if(!shipItem.Received_Datetime__c) {
                isAllReceived = false;
            }
        });
        if(!isAllReceived) {
            ons.notification.alert('Please recieve all assets before you mark this shipment as received.');
            return null;
        }

        shipment.Received_Datetime__c = new Date();
        updateRecord('Shipment__c', shipment, function(updateResponse) {
            console.log(updateResponse);
        });
        cacheReceiveList = cacheReceiveList.filter(function(ship) {
            return ship.Id != highlightShipmentId;
        });
        //renderReceiveShipments(cacheReceiveList, '#receiveShipmentList');
        renderShipmentList(cacheReceiveList, 'receive');
    }
    ons.notification.alert('Successfully '+status);
    myNavigator.popPage();
}


function scanRealAsset() {
        console.log(highlightShipmentId);
        cordova.plugins.barcodeScanner.scan(
            function(result) {
                var alreadyAdded = false;
                if(cacheShipContainerList) {
                    cacheShipContainerList.forEach(function(existingItem) {
                        if(existingItem.Asset_Container__r.Barcode__c == result.text) {
                            alreadyAdded = true;
                            if(existingItem.Load_Datetime__c) {
                                ons.notification.alert('This item is loaded already');
                                return null;
                            }
                            verifyId = existingItem.Id;
                            lastBarcode = result.text;
                            updateVerificationTime(result);
                        }
                    });
                }
                if(!alreadyAdded) {
                    createShipmentContainer(highlightShipmentId, result.text);
                }
            },
            function(error) {
                ons.notification.alert("Scanning failed"+error);
            }
        )
    
}

function scanAsset() {
    var isCamerEnabled = window.localStorage.getItem("isCameraEnabled");
    
   // ons.notification.alert("scan Asset status: " + isCamerEnabled);
   // ons.notification.alert("type: " + typeof(isCamerEnabled));
    
    console.log("isCamerEnabled value is :" + isCamerEnabled);
    
    if (!isCamerEnabled || isCamerEnabled == "false") {
        navigator.camera.getPicture(onSuccess, onFail, { quality: 50,
                                    destinationType: Camera.DestinationType.DATA_URL
                                    });
        
        function onSuccess(imageData) {
            window.localStorage.setItem("isCameraEnabled", true);
            
        }
        
        function onFail(message) {
            window.localStorage.setItem("isCameraEnabled", true);
            var isCamerEnabled = window.localStorage.getItem("isCameraEnabled");
            ons.notification.alert("scan Asset status: " + isCamerEnabled);
            scanRealAsset();
        }
    } else {
        scanRealAsset();
    }
    
    
}

function receiveAsset() {
    console.log(highlightShipmentId);
    cordova.plugins.barcodeScanner.scan(
        function(result) {
            var alreadyReceived = false;
            console.log(JSON.stringify(result));
            //createShipmentContainer(highlightShipmentId, result.text);
            var focusAsset;
            if(cacheShipContainerList) {
                cacheShipContainerList.forEach(function(existingItem) {
                    if(existingItem.Asset_Container__r.Barcode__c == result.text) {
                        if(existingItem.Received_Datetime__c) {
                            ons.notification.alert('This item is marked as received already');
                            alreadyReceived = true;
                        }else {
                            focusAsset = existingItem;
                        }
                    }
                });
            }
            if(focusAsset) {
                updateReceiveTime(focusAsset);
            }else if(!alreadyReceived){
                ons.notification.alert('Scanned item is not added in this shipment');
            }
        },
        function(error) {
            ons.notification.alert("Scanning failed"+error);
        }
    )
}

function receiveShipment () {
    console.log("Inside receive shipment");
    myNavigator.pushPage("receiveShipment.html");
}

function openNewShipment () {
    cacheParentOpp = {};
    myNavigator.pushPage("newShipment.html");
}

function openNewOppShipment () {
    if(cacheSearchResult && cacheSearchResult.length > 0){
        cacheParentOpp = cacheSearchResult[0];
    }
    myNavigator.pushPage("newShipment.html");
}

function getLocationList () {
    fetchRecords(function(result) {
            cacheLocationList = result.records;
            var locationListHtml = '';
            cacheLocationList.forEach(function(loc) {
                locationListHtml += '<option value="'+loc.Id+'">'+loc.Name+'</option>';
            });
            document.querySelector("#locationList").innerHTML = locationListHtml;
        },
        "SELECT Id,Name FROM Location__c WHERE Type__c IN ('Advance warehouse', 'Warehouse', 'Gilbert Warehouse') LIMIT 100"
    );
}

function getCarrierList () {
    fetchRecords(function(result) {
            cacheCarriorList = result.records;
        },
        "SELECT Id, Name FROM Account WHERE Account_Type__c='Vendor/Service Provider' LIMIT 100"
    );
}

function createShipment () {
    var newShipment = {};
    var carrierEl = document.querySelector('#carrier');
    newShipment.Carrier__c = carrierEl.options[carrierEl.selectedIndex].value;
    var fromEl = document.querySelector('#fromLocation');
    newShipment.From_Location__c = fromEl.options[fromEl.selectedIndex].value;
    var toEl = document.querySelector('#toLocation');
    newShipment.To_Location__c = toEl.options[toEl.selectedIndex].value;
    console.log(newShipment);
    if(newShipment.From_Location__c === newShipment.To_Location__c) {
        ons.notification.alert("A shipment cannot have the same location for both ‘From Location’ and ‘To Location’");
        return;
    }
    newShipment.Status__c = "In Progress";
    //newShipment.Shipped_Datetime__c = document.querySelector("#shipDate").value;
    //newShipment.Expected_Availability_date__c = document.querySelector("#availabilityDate").value;
    if(cacheParentOpp.Id) {
        newShipment.Shipping_Trailer_Id__c = document.querySelector("#trailerId").value;
        if(!newShipment.Shipping_Trailer_Id__c) {
            ons.notification.alert("Please enter Trailer ID");
            return;
        }
        newShipment.Opportunity__c = cacheParentOpp.Id;
        //newShipment.Type__c = document.querySelector('input[name="type"]:checked').value;
        newShipment.Type__c = 'NA';
    }else{
        newShipment.Type__c = 'Transfer between warehouses';
    }
    console.log(newShipment);
    createRecord('Shipment__c', newShipment, function(createResponse) {
                    force.query("SELECT Id, Name,Status__c,Type__c,Expected_Availability_date__c,Shipped_Datetime__c,From_Location__r.Name,To_Location__r.Name,Carrier__r.Name, Carrier__c,Shipping_Trailer_Id__c FROM Shipment__c WHERE ID = '"+createResponse.id+"'", 
                        function(shipmentData) {
                            console.log(shipmentData);
                            cacheShipmentList.unshift(shipmentData.records[0]);
                            highlightShipment = shipmentData.records[0];
                            highlightShipmentId = highlightShipment.Id;
                            myNavigator.pushPage("shipmentDetails.html", {data : shipmentData.records[0]})
                                        .then(showAssetContainers(shipmentData.records[0].Id, (cacheParentOpp.Id ? 'ship' : 'transfer')));
                            //renderOpenShipments(cacheShipmentList, '#shipmentList');
                            renderShipmentList(cacheShipmentList, 'ship');
                        }, 
                        function (error) {
                            console.log(error);
                            ons.notification.alert('Failed to fetch data: ' + error);
                        });                  
                });
}

function createShipmentContainer (parentId, barcode) {
    fetchRecords(
        function(result) {
                console.log(result);
                if(result && result.records.length >=1 ){
                    console.log(result.records[0]);
                    var shipmentContainer = {
                                                "Asset_Container__c" : result.records[0].Id,
                                                "Shipment__c" : parentId,
                                                "Load_Datetime__c" : new Date()
                                            };
                    console.log(shipmentContainer);
                    createRecord('Shipment_Container__c', shipmentContainer, function(createResponse) {
                        console.log(createResponse);
                        showAssetContainers (parentId, 'ship'); 
                    });
                }else{
                    ons.notification.alert("There is no asset container matching the barcode");
                }
            },
            "SELECT Id FROM Asset_Container__c WHERE Barcode__c = '"+barcode+"' LIMIT 1"
        );      
}

function deleteShipmentContainer(event) {
    console.log(event.target.dataset.sfid);
    ons.notification.confirm(
            {
                message: "Are you sure you want to delete this asset container?", 
                buttonLabels:["Yes","Cancel"]
            }
        ).then(function(confirmStatus) {
            if(confirmStatus === 0) {
                deleteRecord('Shipment_Container__c',event.target.dataset.sfid,function(response) {
                    showAssetContainers(highlightShipmentId, 'ship');
                });
            }
        });
}

function startVerification (event) {
    console.log(event.target.dataset);
    lastBarcode = event.target.dataset.barcode;
    if(!lastBarcode){
        ons.notification.alert("Not able to find related asset container barcode for verification");
        return;
    }
    if(event.target.dataset.timestamp && event.target.dataset.timestamp != 'null'){
        ons.notification.alert("This asset is loaded already");
    }else{
        verifyBarcode(event.target.dataset.sfid, 'ship');
    }
}

function startReceiving (event) {
    console.log(event.target.dataset);
    lastBarcode = event.target.dataset.barcode;
    if(!lastBarcode){
        ons.notification.alert("Not able to find related asset container barcode for receiving");
        return;
    }
    if(event.target.dataset.timestamp && event.target.dataset.timestamp != 'null'){
        ons.notification.alert("This asset is marked as received already");
    }else{
        verifyBarcode(event.target.dataset.sfid,'receive');
    }
}

function startNewReceiving () {
    lastTrailerId = document.querySelector('#receiveTrailerId').value;
    if(!lastTrailerId) {
        ons.notification.alert("Please enter Trailer ID");
        return;
    }
    cordova.plugins.barcodeScanner.scan(
        function (result) {
            updateNewReceived(result);
        },
        function (error) {
            ons.notification.alert("Scanning failed: " + error);
        }, 
        scannerSettings
    );
}

function updateNewReceived(result) {
    console.log(result);
    fetchRecords(
        function(result) {
                console.log(result);
                if(result && result.records.length >=1 ){
                    if(result.records.length > 1) {
                        ons.notification.alert("There are more than one shipment containers with matching the barcode and shipment status as 'Received'");
                    }else {
                        var shipmentContainer = result.records[0];
                        if(shipmentContainer.Received_Datetime__c) {
                            ons.notification.alert("This shipment container is already marked as received");
                            return;
                        }
                        shipmentContainer.Received_Datetime__c = new Date();
                        shipmentContainer.Received_Trailer_Id__c = lastTrailerId;
                        var copyContainer = JSON.parse(JSON.stringify(shipmentContainer));
                        delete shipmentContainer.Asset_Container__r;
                        updateRecord('Shipment_Container__c', shipmentContainer, function(updateResponse) {
                            console.log(updateResponse);
                            var listEl = document.querySelector('#receviedList');
                            listEl.innerHTML = generateIndividualItem(copyContainer, false) + listEl.innerHTML;
                        });
                        //Updating user's location as received container location
                        var assetContainer = {};
                        assetContainer.Id = copyContainer.Asset_Container__c;
                        assetContainer.Current_Location__c = selectedLocation;
                        updateRecord('Asset_Container__c', assetContainer, function(updateResponse) {
                            console.log(updateResponse);
                        });
                    }
                }else{
                    ons.notification.alert("There is no shipment container with matching the barcode and parent shipment status as 'Received'");
                }
            },
            "SELECT Id, Received_Trailer_Id__c, Received_Datetime__c, Asset_Container__c, Asset_Container__r.Name,Asset_Container__r.Barcode__c,Load_Datetime__c  FROM Shipment_Container__c WHERE Asset_Container__r.Barcode__c = '"+result.text+"' AND Shipment__r.Status__c ='Received' LIMIT 1"
        );   
}

function resetReceiveScreen () {
    document.querySelector('#receiveTrailerId').value = '';
    document.querySelector('#receviedList').innerHTML = '';
}

function verifyBarcode(shipContainerId, operation) {
    verifyId = shipContainerId;
    cordova.plugins.barcodeScanner.scan(
        function (result) {
            updateVerificationTime(result, operation);
        },
        function (error) {
            ons.notification.alert("Scanning failed: " + error);
        }, 
        scannerSettings
    );
}

function updateVerificationTime (scannedData, operation) {
    if(scannedData.text === lastBarcode){
        var container = {};
        container.Id = verifyId;
        if(operation == 'ship'){
            if(!container.Load_Datetime__c) {
                container.Load_Datetime__c = new Date();
            } 
        }else if(operation == 'receive') {
            if(!container.Received_Datetime__c) {
                container.Received_Datetime__c = new Date();
            } 
        }
        updateRecord('Shipment_Container__c', container, function(updateResponse) {
            console.log(updateResponse);
            showAssetContainers(highlightShipmentId, operation);
        });
    }else{
        ons.notification.alert("Barcodes does not match");
    }
}

function updateReceiveTime (receivedContainer) {
    receivedContainer.Received_Datetime__c = new Date();
    var container = {};
        container.Id = receivedContainer.Id;
        container.Received_Datetime__c = new Date();

    updateRecord('Shipment_Container__c', container, function(updateResponse) {
        console.log(updateResponse);
        showAssetContainers(highlightShipmentId, 'receive');
    });
}

function scanBarcode() {
    cordova.plugins.barcodeScanner.scan(
        function (result) {
            ons.notification.alert("We got a barcode\n" +
                "Result: " + result.text + "\n" +
                "Format: " + result.format + "\n" +
                "Cancelled: " + result.cancelled);
        },
        function (error) {
            ons.notification.alert("Scanning failed: " + error);
        }, 
        scannerSettings
    );
}
