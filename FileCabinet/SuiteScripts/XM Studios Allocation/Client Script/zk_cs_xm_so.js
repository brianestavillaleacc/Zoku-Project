/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search'], function (currentRecord, record, search) {
    var currentSoRecord = currentRecord.get();
    var getSoId = currentSoRecord.getValue({fieldId: 'id'});

    function closeSalesOrder() {
        var recSO = record.load({ id: getSoId, type: record.Type.SALES_ORDER, isDynamic: true });
        var stPOSReceiptNumber = recSO.getValue("custbody_pos3_receiptnumber");
        var stPOSMachine = recSO.getValue("custbody_pos3_machine");

        if(!stPOSReceiptNumber || !stPOSMachine) {
            closeNonPOSWebsiteSales(recSO)
        } else {
            closePOSWebsiteSales(recSO);
        }

        window.location.reload(true);
    }

    function closePOSWebsiteSales(recSO) {
        var errorMessage = "";
        for(var intIndex=0; intIndex<recSO.getLineCount({ sublistId: 'item' }); intIndex++) {
            var intProductAllocationId = recSO.getSublistValue({sublistId: "item", fieldId: 'custcol_zoku_product_allocation', line: intIndex});
            if(intProductAllocationId) {
                var lineNum = recSO.selectLine({ sublistId: 'item', line: intIndex });
                var fieldLookUpProductAllocation = search.lookupFields({
                    type: "customrecord_zk_product_allocation",
                    id: intProductAllocationId,
                    columns: ['custrecord_zk_pa_status']
                });

                if(fieldLookUpProductAllocation.custrecord_zk_pa_status[0].value == 3) {
                    errorMessage = "Cancellation of Product Allocation is being processed. This Sales Order will be automatically closed once its done.";
                }

                if(!errorMessage) {
                    var flAllocationQuantity = recSO.getCurrentSublistValue({sublistId: "item", fieldId: "quantity"});
                    var intItemId = recSO.getCurrentSublistValue({sublistId: "item", fieldId: "item"});
                    recSO.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true, ignoreFieldChange: true });
                    recSO.commitLine({sublistId: 'item', line: intIndex});
                    //updateProductAllocation(intProductAllocationId, recSO.id, flAllocationQuantity, intItemId);
                }
            }else {
                recSO.selectLine({ sublistId: 'item', line: intIndex });
                recSO.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true, ignoreFieldChange: true });
                recSO.commitLine({sublistId: 'item', line: intIndex});
            }
        }

        if(errorMessage) {
            alert(errorMessage);
        } else {
            recSO.save();
        }

    }

    function closeNonPOSWebsiteSales(recSO) {
        var getPaId = recSO.getSublistValue({sublistId: "item", fieldId: 'custcol_zoku_product_allocation', line: 1});

        var fieldLookUpProductAllocation = search.lookupFields({
            type: "customrecord_zk_product_allocation",
            id: getPaId,
            columns: ['custrecord_zk_pa_status']
        });

        if(fieldLookUpProductAllocation.custrecord_zk_pa_status[0].value == 3) {
            alert("Cancellation of Product Allocation is being processed. This Sales Order will be automatically closed once its done.");
        } else {
            var flAllocationQuantity = recSO.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
            var intItemId = recSO.getSublistValue({sublistId: "item", fieldId: "item", line: 1});
            var intLineCount = recSO.getLineCount({ sublistId: 'item' });

            for (var lineIndex = 0; lineIndex < intLineCount; lineIndex++) {

                var lineNum = recSO.selectLine({
                    sublistId: 'item',
                    line: lineIndex
                });
                recSO.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'isclosed',
                    value: true,
                    ignoreFieldChange: true
                });
                recSO.commitLine({
                    sublistId: 'item',
                    line: lineIndex
                });
            }
            var intSOId = recSO.save();
            //updateProductAllocation(getPaId, intSOId, flAllocationQuantity,intItemId);

        }
    }

    function updateProductAllocation(getPaId, intSOId, flAllocationQuantity,intItemId) {
        var srProductAllocation = search.lookupFields({
            type: 'customrecord_zk_product_allocation',
            id: getPaId,
            columns: ['custrecord_zk_pa_allocated_quantity', 'custrecord_zk_pa_ordered_quantity', 'custrecord_zk_pa_leftovers']
        });
        var flCurrentOrderedQty = srProductAllocation['custrecord_zk_pa_ordered_quantity'] - flAllocationQuantity;
        var flCurrentLeftOverQty = srProductAllocation['custrecord_zk_pa_leftovers'];

        var objRemainingQty = {};
        objRemainingQty['custrecord_zk_pa_ordered_quantity'] = srProductAllocation['custrecord_zk_pa_ordered_quantity'] - flAllocationQuantity
        objRemainingQty['custrecord_zk_pa_leftovers'] = flCurrentLeftOverQty;
        objRemainingQty['custrecord_zk_pa_allocated_quantity'] = flCurrentOrderedQty + flCurrentLeftOverQty;
        record.submitFields({
            type: 'customrecord_zk_product_allocation',
            id: getPaId,
            values: objRemainingQty
        });
        updateEstimatedManufacturedQuantityCancelled(intItemId,flAllocationQuantity);

        if (!checkRemainingSOs(getPaId, intSOId)) {
            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: getPaId,
                values: {
                    custrecord_zk_pa_status: '3',
                    custrecord_zk_pa_ordered_quantity: 0,
                    custrecord_zk_pa_leftovers: 0,
                    custrecord_zk_pa_allocated_quantity: 0
                }
            });
        }
    }

    function checkRemainingSOs(intProductAlloc, intSOId) {
        var srSalesOrder = search.create({
            type: "salesorder",
            filters:
                [
                    ["type", "anyof", "SalesOrd"], "AND",
                    ["internalid", "noneof", [intSOId]], "AND",
                    ["custcol_zoku_product_allocation", "anyof", intProductAlloc], "AND",
                    ["status", "noneof", "SalesOrd:C", "SalesOrd:H"], "AND",
                    ["mainline", "is", "F"]
                ]
        });
        var inSOCount = srSalesOrder.runPaged().count;
        return inSOCount > 0;
    }

    function updateEstimatedManufacturedQuantityCancelled(intItemId,flAllocationQuantity) {

        var arrItemTypes = {
            "Description": "descriptionitem",
            "Discount": "discountitem",
            "InvtPart": "inventoryitem",
            "Kit": "kititem",
            "Markup": "markupitem",
            "NonInvtPart": "noninventoryitem",
            "OthCharge": "otherchargeitem",
            "Payment": "paymentitem",
            "Service": "serviceitem"
        };
        var lookupFieldItem = search.lookupFields({
            type: search.Type.ITEM,
            id: intItemId,
            columns: ['custitem_zk_available_manufacture_qty', 'type', 'isserialitem', 'islotitem']
        });
        var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
        if (lookupFieldItem.isserialitem) {
            stItemType = "serializedinventoryitem";
        }
        if (lookupFieldItem.islotitem) {
            stItemType = "lotnumberedinventoryitem";
        }

        var flRemaningQuantity = 0;
        var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;
        flRemaningQuantity = parseFloat(flEstimatedQuantity) + flAllocationQuantity;

        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
        });
    }

    return {
        closeSalesOrder: closeSalesOrder
    };

});
