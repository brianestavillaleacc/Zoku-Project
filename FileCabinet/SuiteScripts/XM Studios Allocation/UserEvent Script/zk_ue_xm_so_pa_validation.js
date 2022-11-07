/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_ue_xm_product_allocation
Name                : Production Allocation
Purpose             : Product Allocation add functionality
Created On          : September 21,2021
Author              : Ceana Technology
Script Type         : User Event Script
Saved Searches      : NONE
*/

define(['N/ui/serverWidget', '../Library/zk_xm_library', 'N/search', 'N/record'], function (serverWidget, libHelper, search, record) {

    /**
     * Defines the function definition that is executed after record is submitted.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
     * @since 2015.2
     */
    const STATUS_CANCELLED = "Cancelled";
    const STATUS_CLOSED = "closed";
    const INVOICE_FORM = "166"

    const PREORDER_ITEM = "1"
    const IN_STOCK = "2"
    // const XM_STORE_ALLOCATION_DISTRIBUTOR = "26694"; //- SB
    const XM_STORE_ALLOCATION_DISTRIBUTOR = "27721"
    // const XM_WEBSITE_WOO_COMMERCE_DISTRIBUTOR = "26696"; //- SB
    const XM_WEBSITE_WOO_COMMERCE_DISTRIBUTOR = "27725"
    const ADVANCED_ITEM_TAX_CODE = 6

    const DEV_NOTICE = "Please know that there is an ongoing development at the moment"
    const DEV_NOTIFY = false

    function afterSubmit(scriptContext) {
        try{
            var oldRecord = scriptContext.oldRecord;
            var newRecord = scriptContext.newRecord;

            var inPOSMachine = newRecord.getValue("custbody_pos3_machine");
            var stPOSReceiptNumber = newRecord.getValue("custbody_pos3_receiptnumber");
            var bolIsPOS = inPOSMachine && stPOSReceiptNumber? true: false
            var bolIsWebsiteSales = inPOSMachine && !stPOSReceiptNumber? true: false
            var bolIsPosOrWebsiteSales = bolIsPOS || bolIsWebsiteSales? true: false

            const objNewItemWithProductAllocation = getInventoryItemsWithProductAllocation(oldRecord)

            if(scriptContext.type == 'edit' || scriptContext.type == 'xedit') {

                var recSO = search.lookupFields({
                    type: newRecord.type,
                    id: newRecord.id,
                    columns: ['status']
                })
                var intStatus = recSO.status[0].value
                log.debug("afterSubmit intStatus", intStatus);

                if (intStatus ==  STATUS_CLOSED && newRecord.getValue("status") != "Closed") {
                    for(var intKey in objNewItemWithProductAllocation) {
                        var intProductAllocation = objNewItemWithProductAllocation[intKey].productAllocation
                        var intLineIndex = objNewItemWithProductAllocation[intKey].lineIndex
                        var intQuantity = objNewItemWithProductAllocation[intKey].quantity
                        updateProductAllocationOnClosed(intProductAllocation, newRecord.id, intQuantity, intKey)
                    }
                }
            } else if(scriptContext.type == 'create') {

                log.debug('afterSubmit: create params', {inPOSMachine:inPOSMachine, stPOSReceiptNumber:stPOSReceiptNumber, recordid:newRecord.id})

                if(bolIsPosOrWebsiteSales){

                    var allItems = getAllLineItems(newRecord, 'item');
                    // allItems = appendLookupItems(allItems);
                    // const arrInventoryItems = getItemsByType(allItems, 'InvtPart')
                    const arrInventoryItems = appendLookupItems(allItems);

                    //pre order items should always have an advanced item
                    var arrPreOrderItems = arrInventoryItems.filter(function(objItem) {
                        return objItem.is_preorder == true
                    })

                    //Skip creation of invoice if there is no Pre-order item
                    if(arrPreOrderItems.length==0) return

                    var arrAdvancedItems = arrPreOrderItems.map(function(objItem) {
                        return objItem.advanced_item_id
                    })

                    //create Invoice from advanced item
                    var recNewInvoice = record.transform({
                        fromType: record.Type.SALES_ORDER,
                        fromId: newRecord.id,
                        toType: record.Type.INVOICE,
                        isDynamic: true,
                    })

                    var intLineCount = recNewInvoice.getLineCount({sublistId: 'item'})

                    var itemsToBeRemoved = []

                    for(var lineIndx=intLineCount-1; lineIndx>=0; lineIndx--) {

                        var intItemId = recNewInvoice.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: lineIndx
                        })
                        var intRate = recNewInvoice.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: lineIndx
                        })
                        var stType = recNewInvoice.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemtype',
                            line: lineIndx
                        })

                        //remove advanced items with negative value and invetory items
                        if((arrAdvancedItems.indexOf(intItemId) == -1 || Number(intRate) < 0)) {

                            recNewInvoice.removeLine({
                                sublistId: 'item',
                                line: lineIndx
                            });
                            itemsToBeRemoved.push({
                                intItemId: intItemId,
                                intRate: intRate,
                                stType: stType
                            })
                            continue
                        }
                    }
                    recNewInvoice.save()
                    return
                }
            }
        }catch(objError) {
            if(DEV_NOTIFY == true) {
                log.error('error catched', objError)
                throw DEV_NOTICE
            }
            log.error('error catched', objError)
            throw objError
        }
    }

    function beforeSubmit(context) {
        // try {
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;

        var inPOSMachine = newRecord.getValue("custbody_pos3_machine");
        var stPOSReceiptNumber = newRecord.getValue("custbody_pos3_receiptnumber");
        var bolIsPOS = inPOSMachine && stPOSReceiptNumber? true: false
        var bolIsWebsiteSales = inPOSMachine && !stPOSReceiptNumber? true: false
        var bolIsPosOrWebsiteSales = bolIsPOS || bolIsWebsiteSales? true: false
        var intDistributorId = bolIsPOS? XM_STORE_ALLOCATION_DISTRIBUTOR: bolIsWebsiteSales? XM_WEBSITE_WOO_COMMERCE_DISTRIBUTOR: 0

        log.debug('beforeSubmit: params', {inPOSMachine:inPOSMachine, stPOSReceiptNumber:stPOSReceiptNumber})

        if(context.type == "create") {
            if(bolIsPosOrWebsiteSales) {

                var allItems = getAllLineItems(newRecord, 'item');
                // allItems = appendLookupItems(allItems);
                // const arrInventoryItems = getItemsByType(allItems, 'InvtPart');
                const arrInventoryItems = appendLookupItems(allItems);

                //pre order items should always have an advanced item
                var arrPreOrderItems = arrInventoryItems.filter(function(objItem) {
                    return objItem.is_preorder == true
                })
                checkIfPreOrderHasNoAdvancedItem(arrPreOrderItems)
                arrPreOrderItems = appendProductAllocation(arrPreOrderItems, intDistributorId)

                var arrRegularItems = arrInventoryItems.filter(function(objItem) {
                    return objItem.is_preorder == false
                })
                arrRegularItems = appendProductAllocation(arrRegularItems, intDistributorId)

                const intLocation = newRecord.getValue({fieldId: 'location'})
                newRecord.setValue({fieldId: 'orderstatus', value: 'B'})

                var lineCount = allItems.length

                //set product allocation on regular item
                if(arrRegularItems.length > 0) {
                    arrRegularItems.forEach(function(objItem) {
                        if(objItem['is_allocated'] && objItem['custcol_zoku_product_allocation']) {
                            newRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_zoku_product_allocation', line: objItem['itemIndex'], value: objItem['custcol_zoku_product_allocation']});
                            updateProductAllocationLeftOverAndOrderedQty(objItem , context)
                            updateEstimatedManufacturedQuantity(context, objItem['itemIndex'])
                        }
                    })
                }

                //set product allocation on pre-order item
                if(arrPreOrderItems.length > 0) {
                    arrPreOrderItems.forEach(function(objItem) {
                        if(objItem['is_preorder'] && objItem['custcol_zoku_product_allocation']) {
                            newRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_zoku_product_allocation', line: objItem['itemIndex'], value: objItem['custcol_zoku_product_allocation']});
                            updateProductAllocationLeftOverAndOrderedQty(objItem, context)
                            updateEstimatedManufacturedQuantity(context, objItem['itemIndex'])
                        }
                    })
                }

                const arrAdditionalColumns = [
                    'description',
                    'custcol_pos3_salesrep',
                    'custcol_pos3_discpromo',
                    'custcol_pos3_item',
                    'custcol_pos3_nettotal'
                ]
                //append advanced items
                arrPreOrderItems.forEach(function(objItem) {

                    // arrAdditionalColumns.forEach(function(stColumn) {
                    //     newRecord.setSublistValue({sublistId: 'item', fieldId: stColumn, line: lineCount, value: ''});
                    // })
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'item', line: lineCount, value: objItem['advanced_item_id']});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'quantity', line: lineCount, value: objItem['quantity']});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'rate',line: lineCount, value: objItem['deposit_amount']});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'location',line: lineCount, value: intLocation});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'taxcode',line: lineCount, value: ADVANCED_ITEM_TAX_CODE});
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_original_rate',
                        line: lineCount,
                        value: objItem['deposit_amount']
                    });
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: lineCount,
                        value: Number(objItem['deposit_amount']) * Number(objItem['quantity'])
                    });
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_zoku_product_allocation', line: lineCount, value: ''});
                    lineCount++


                    // arrAdditionalColumns.forEach(function(stColumn) {
                    //     newRecord.setSublistValue({sublistId: 'item', fieldId: stColumn, line: lineCount, value: ''});
                    // })
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'item', line: lineCount, value: objItem['advanced_item_id']});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'location',line: lineCount, value: intLocation});
                    newRecord.setSublistValue({sublistId: 'item', fieldId: 'taxcode',line: lineCount, value: ADVANCED_ITEM_TAX_CODE});
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: lineCount,
                        value: Number(objItem['quantity']) * -1
                    });
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        line: lineCount,
                        value: Number(objItem['deposit_amount']) * -1
                    });
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_original_rate',
                        line: lineCount,
                        value: Number(objItem['deposit_amount']) * -1
                    });
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: lineCount,
                        value: (Number(objItem['deposit_amount']) * Number(objItem['quantity'])) * -1
                    });
                    lineCount++

                })
            }
            return
        } else if(context.type == "cancel") {
            checkCancellationProcess(context);
        } else if (context.type == "delete") {
            const objNewItemWithProductAllocation = getInventoryItemsWithProductAllocation(newRecord)
            log.debug("objNewItemWithProductAllocation", objNewItemWithProductAllocation);
            if (oldRecord.getValue("status") != STATUS_CANCELLED && oldRecord.getValue("status") != STATUS_CLOSED) {
                for(var intKey in objNewItemWithProductAllocation) {
                    var intProductAllocation = objNewItemWithProductAllocation[intKey].productAllocation
                    var intLineIndex = objNewItemWithProductAllocation[intKey].lineIndex
                    var intQuantity = objNewItemWithProductAllocation[intKey].quantity
                    updateProductAllocationOnClosed(intProductAllocation, newRecord.id, intQuantity, intKey)

                }

            }
        } else if(context.type == "edit") {
            var oldRecord = context.oldRecord
            var newRecord = context.newRecord

            var arrOldLines = getAllLineItems(oldRecord, 'item')
            arrOldLines = arrOldLines.length == 0? []: appendLookupItems(arrOldLines)

            var arrNewLines = getAllLineItems(newRecord, 'item')
            arrNewLines = arrNewLines.length == 0? []: appendLookupItems(arrNewLines)
            if(arrNewLines == 0) return
            arrNewLines = appendExistingProductAllocationDetails(arrNewLines)

            log.debug('beforeSubmit edit', {
                arrOldLines: arrOldLines,
                arrNewLines: arrNewLines
            })

            arrNewLines.forEach(function(objNewLine, lineIndex) {
                if(!objNewLine['custcol_zoku_product_allocation']) return

                var oldQuantity = arrOldLines[lineIndex].quantity;
                var oldProductAllocationLine = arrOldLines[lineIndex].custcol_zoku_product_allocation;
                var newQuantity = arrNewLines[lineIndex].quantity;
                var newProductAllocationLine = arrNewLines[lineIndex].custcol_zoku_product_allocation;

                if(oldQuantity != newQuantity || oldProductAllocationLine != newProductAllocationLine) {
                    updateEstimatedManufacturedQuantity(context, lineIndex);
                    updateProductAllocationLeftOverAndOrderedQty(objNewLine, context);

                    const stLineCount = newRecord.getLineCount({sublistId: 'item'})
                    for(var intIndex=0; intIndex<stLineCount; intIndex++) {
                        var intItem = newRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line:intIndex})
                        if(intItem == objNewLine['advanced_item_id']) {
                            var intAdvancedItemQty = newRecord.getSublistValue({sublistId: 'item', fieldId: 'quantity', line:intIndex})
                            newRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line:intIndex,
                                value: intAdvancedItemQty < 1? (newQuantity*-1):newQuantity
                            })
                        }
                    }
                }
            })

            var recSO = search.lookupFields({
                type: newRecord.type,
                id: newRecord.id,
                columns: ['status']
            })
            var intStatus = recSO.status[0].value
            log.debug("beforeSubmit intStatus", intStatus);
        }

        // } catch(objError) {
        //     log.error('error catched', objError)
        //     if(DEV_NOTIFY == true) throw DEV_NOTICE
        //     //throw objError
        // }

    }

    function form_button(fetchContext) {
        var currentForm = fetchContext.form;
        var currentRecord = fetchContext.newRecord;
        var stSoStatus = currentRecord.getValue({
            fieldId: 'status'
        });

        var intProductAllocId = currentRecord.id;
        if (fetchContext.type === fetchContext.UserEventType.VIEW) {
            if(currentForm.getButton({ id : 'closeremaining' })) {
                currentForm.removeButton('closeremaining');
                currentForm.addButton({
                    id: 'custpage_closeremaining_custom',
                    label: 'Close Order',
                    functionName: 'closeSalesOrder'
                });
            }
        }
        currentForm.clientScriptModulePath = '../Client Script/zk_cs_xm_so.js';
    }

    function beforeLoad(scriptContext) {
        try {
            if (scriptContext.type == "create") {
                return;
            }
            form_button(scriptContext);
        } catch (err) {
            log.debug('error catched', err);
        }
    }

    function checkCancellationProcess(context) {
        var newRecord = context.newRecord;
        var errorMessage = "";
        for (var lineIndex = 0; lineIndex < newRecord.getLineCount({ sublistId: 'item' }); lineIndex++) {
            var intProductAllocationId = newRecord.getSublistValue({sublistId: "item", fieldId: 'custcol_zoku_product_allocation', line: lineIndex});
            var intItemId = newRecord.getSublistValue({sublistId: "item", fieldId: 'item', line: lineIndex});
            var flQuantity = newRecord.getSublistValue({sublistId: "item", fieldId: 'quantity', line: lineIndex});
            if(intProductAllocationId) {
                var fieldLookUpProductAllocation = search.lookupFields({
                    type: "customrecord_zk_product_allocation",
                    id: intProductAllocationId,
                    columns: ['custrecord_zk_pa_status']
                });

                log.debug("fieldLookUpProductAllocation", fieldLookUpProductAllocation);

                if(fieldLookUpProductAllocation.custrecord_zk_pa_status[0].value == libHelper.allocationStatus.CANCELLED) {
                    errorMessage = "Cancellation of Product Allocation is being processed. This Sales Order will be automatically closed once its done.";
                } else {
                    updateProductAllocationOnClosed(intProductAllocationId, newRecord.id, flQuantity,intItemId);
                }
            }
        }

        if(errorMessage) {
            throw errorMessage;
        }
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

                var flAllocationQuantity = recSO.getCurrentSublistValue({sublistId: "item", fieldId: "quantity"});
                var intItemId = recSO.getCurrentSublistValue({sublistId: "item", fieldId: "item"});
                recSO.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true, ignoreFieldChange: true });
                recSO.commitLine({sublistId: 'item', line: intIndex});
                //updateProductAllocation(intProductAllocationId, recSO.id, flAllocationQuantity, intItemId);

            } else {
                recSO.selectLine({ sublistId: 'item', line: intIndex });
                recSO.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true, ignoreFieldChange: true });
                recSO.commitLine({sublistId: 'item', line: intIndex});
            }
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
            //updateProductAllocation(getPaId, intSOId, flAllocationQuantity,intItemId);

        }
    }

    function hasRemainingSalesOrders(intProductAlloc, intSOId) {
        var srSalesOrder = search.create({
            type: "salesorder",
            filters: [
                ["type", "anyof", "SalesOrd"], "AND",
                ["custcol_zoku_product_allocation","anyof",intProductAlloc], "AND",
                ["status", "noneof", "SalesOrd:C", "SalesOrd:H"], "AND",
                ["mainline", "is", "F"], "AND",
                ["internalid","noneof",[intSOId]]
            ]
        });
        var inSOCount = srSalesOrder.runPaged().count;
        log.debug("inSOCount", inSOCount);
        return inSOCount > 0;
    }

    function updateEstimatedManufacturedQuantity(context, intLine) {
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;
        var intItemId = newRecord.getSublistValue({sublistId: "item", fieldId: "item", line: intLine});
        var flNewAllocationQuantity = newRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: intLine});
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

        if(context.type == 'create') {
            var flQuantity = flNewAllocationQuantity;
            var flRemaningQuantity = 0;
            var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;
            flRemaningQuantity = parseFloat(flEstimatedQuantity) - parseFloat(flQuantity);

        } else {
            var flRemaningQuantity = 0;
            var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;
            var flOldAllocationQuantity = oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: intLine});
            var intOldProductAllocationLine = oldRecord.getSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation", line: intLine});
            var intNewProductAllocationLine = newRecord.getSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation", line: intLine});

            if(intOldProductAllocationLine == intNewProductAllocationLine) {
                if (flNewAllocationQuantity > flOldAllocationQuantity) {
                    var flExcessQuantity = parseFloat(flNewAllocationQuantity) - parseFloat(flOldAllocationQuantity);
                    flRemaningQuantity = parseFloat(flEstimatedQuantity) - flExcessQuantity;
                } else {
                    var flToBeReturnedQuantity = parseFloat(flOldAllocationQuantity) - parseFloat(flNewAllocationQuantity);
                    flRemaningQuantity = parseFloat(flEstimatedQuantity) + flToBeReturnedQuantity;
                }
            } else {
                if(!intOldProductAllocationLine) {
                    var flQuantity = flNewAllocationQuantity;
                    flRemaningQuantity = parseFloat(flEstimatedQuantity) - parseFloat(flQuantity);
                }
            }

        }

        log.debug("flRemaningQuantity", flRemaningQuantity);

        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
        });
    }

    function appendProductAllocationToItem(arrProductAllocation, arrInvoiceLineItems) {
        arrInvoiceLineItems.forEach(function(objLineItem) {
            arrProductAllocation.forEach(function(objProductAllocation) {
                if(objLineItem.item == objProductAllocation.item) {
                    for(var stKey in objProductAllocation) {
                        objLineItem[stKey] = objProductAllocation[stKey]
                    }
                }
            })
        })

        return arrInvoiceLineItems
    }

    function appendProductAllocation(arrInvoiceLineItems, intDistributorId) {

        if(arrInvoiceLineItems == 0) return []

        const arrProductAllocation = []
        arrInvoiceLineItems.forEach(function(objLineItem) {
            const objProductAllocation = getOneProductAllocationWithAvailableLeftOvers(objLineItem, intDistributorId)
            arrProductAllocation.push(objProductAllocation)
        })

        log.debug("arrProductAllocation", arrProductAllocation);

        const arrItemsToBeSet = appendProductAllocationToItem(arrProductAllocation, arrInvoiceLineItems)

        return arrItemsToBeSet
    }

    function updateProductAllocationLeftOverAndOrderedQty(objItem, context) {
        var flNewLeftOver=0, flOrderedQuantity=0, intAddedQuantity=0, intDeductedQuantity=0;

        if(context.type == 'create') {
            flNewLeftOver = parseFloat(objItem['left_overs']) - parseFloat(objItem['quantity'])
            flOrderedQuantity = parseFloat(objItem['ordered_quantity']) || 0
            flOrderedQuantity = flOrderedQuantity + objItem['quantity']
            if(flNewLeftOver < 0) {
                throw {
                    message: 'Leftovers of product allocation with id of '+objItem['custcol_zoku_product_allocation']+' has less than the line item quantity'
                }
            }

            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: objItem['custcol_zoku_product_allocation'],
                values: {
                    'custrecord_zk_pa_leftovers': flNewLeftOver,
                    'custrecord_zk_pa_ordered_quantity': flOrderedQuantity,
                    'custrecord_zk_pa_allocated_quantity': flNewLeftOver + flOrderedQuantity
                }
            });
        } else {
            var intOldQuantity = Number(context.oldRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: objItem['itemIndex']}));
            var intOldProductAllocationLine = Number(context.oldRecord.getSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation", line: objItem['itemIndex']}));
            var intNewQuantity = Number(context.newRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: objItem['itemIndex']}));
            var intNewProductAllocationLine = Number(context.newRecord.getSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation", line: objItem['itemIndex']}));

            if(intOldProductAllocationLine == intNewProductAllocationLine) {
                if(intOldQuantity < intNewQuantity) { //deduct left overs and increase order quantity
                    intAddedQuantity = intNewQuantity - intOldQuantity
                    if(objItem['left_overs']!="" || objItem['left_overs']>0){
                        flNewLeftOver = parseFloat(objItem['left_overs']) - intAddedQuantity
                    }
                    flOrderedQuantity = parseFloat(objItem['ordered_quantity']) || 0
                    flOrderedQuantity = flOrderedQuantity + intAddedQuantity
                } else if(intOldQuantity > intNewQuantity) { //increase left overs and deduct ordered quantity
                    intDeductedQuantity = intOldQuantity - intNewQuantity;
                    if(objItem['left_overs']!="" || objItem['left_overs']>0){
                        flNewLeftOver = parseFloat(objItem['left_overs']) + intDeductedQuantity;
                    }

                    flOrderedQuantity = parseFloat(objItem['ordered_quantity']) || 0;
                    flOrderedQuantity = flOrderedQuantity - intDeductedQuantity;
                }

                record.submitFields({
                    type: 'customrecord_zk_product_allocation',
                    id: objItem['custcol_zoku_product_allocation'],
                    values: {
                        'custrecord_zk_pa_leftovers': flNewLeftOver,
                        'custrecord_zk_pa_ordered_quantity': flOrderedQuantity,
                        'custrecord_zk_pa_allocated_quantity': flNewLeftOver + flOrderedQuantity
                    }
                });
            } else {
                if(!intOldProductAllocationLine) {
                    if(objItem['left_overs']!="" || objItem['left_overs']>0){
                        flNewLeftOver = parseFloat(objItem['left_overs']) - intNewQuantity;
                        flOrderedQuantity = parseFloat(objItem['ordered_quantity']) || 0;
                        flOrderedQuantity = flOrderedQuantity + intNewQuantity;
                    }
                    record.submitFields({
                        type: 'customrecord_zk_product_allocation',
                        id: intNewProductAllocationLine,
                        values: {
                            'custrecord_zk_pa_leftovers': flNewLeftOver,
                            'custrecord_zk_pa_ordered_quantity': flOrderedQuantity,
                            'custrecord_zk_pa_allocated_quantity': flNewLeftOver + flOrderedQuantity
                        }
                    });
                }
            }


        }
    }

    function getInventoryItemsWithProductAllocation(record) {
        var objResult = {}

        if(!record) return {}
        const intlineCount = record.getLineCount({
            sublistId: 'item'
        })
        for(var itemIndx=0; itemIndx<intlineCount; itemIndx++) {
            var intProductAllocation =  record.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_zoku_product_allocation',
                line: itemIndx
            })
            var intItem = record.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: itemIndx
            })
            if(!intProductAllocation) continue
            objResult[intItem] = {
                lineIndex: itemIndx,
                quantity: record.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: itemIndx
                }),
                productAllocation: intProductAllocation
            }
        }

        return objResult
    }

    function getAllLineItems(objRecord, stItemType) {

        if(!objRecord) return

        var intLineCount = objRecord.getLineCount({sublistId: stItemType})

        var arrInvoiceLineItems = []
        var arrItemFieldMapping = {
            'item': 'item',
            'quantity': 'quantity',
            'rate': 'rate',
            'amount': 'amount',
            'itemtype': 'itemtype',
            'custcol_zoku_product_allocation': 'custcol_zoku_product_allocation',
            'description': 'description',
            'custcol_pos3_salesrep': 'custcol_pos3_salesrep',
            'custcol_pos3_discpromo': 'custcol_pos3_discpromo',
            'custcol_pos3_item': 'custcol_pos3_item',
            'custcol_pos3_nettotal': 'custcol_pos3_nettotal'

        }
        for (var itemIndex = 0; itemIndex < intLineCount; itemIndex++) {
            var objItem = {}
            for (var stItemName in arrItemFieldMapping) {
                objItem[stItemName] = objRecord.getSublistValue({
                    sublistId: stItemType,
                    fieldId: arrItemFieldMapping[stItemName],
                    line: itemIndex,
                })
            }
            if(!objItem['amount']) objItem['amount'] = 0
            objItem['itemIndex'] = itemIndex
            arrInvoiceLineItems.push(objItem)
        }
        return arrInvoiceLineItems;
    }

    function getItemsByType(arrLineItems, stType) {
        return  arrLineItems.filter(function(objLine) {
            return objLine.itemtype == stType;
        })
    }

    function getOneProductAllocationWithAvailableLeftOvers(objInventoryItem, intDistributor) {
        const intItemId = objInventoryItem['item']
        const intQty = objInventoryItem['quantity']
        var objResult = {};

        var srAllocationProduct = search.create({
            type: 'customrecord_zk_product_allocation',
            filters: [
                ['isinactive', 'is', 'F'], 'AND',
                ['custrecord_zk_pa_item', 'is', intItemId], 'AND',
                ['custrecord_zk_pa_distributor', 'is', intDistributor], 'AND',
                ['custrecord_zk_pa_status', 'is', libHelper.allocationStatus.ACKNOWLEDGE],"AND",
                ["custrecord_zk_pa_leftovers","greaterthanorequalto",intQty]
            ],
            columns: [
                search.createColumn({name: "custrecord_zk_pa_item"}),
                search.createColumn({name: "custrecord_zk_pa_leftovers"}),
                search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                search.createColumn({name: "custrecord_zk_pa_ordered_quantity"}),
                search.createColumn({name: "custitem_zk_advance_item", join: "CUSTRECORD_ZK_PA_ITEM"}),
                search.createColumn({name: "custitem_zk_deposit_amount", join: "CUSTRECORD_ZK_PA_ITEM"}),
                search.createColumn({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                search.createColumn({name: "pricinggroup", join: "CUSTRECORD_ZK_PA_ITEM"}),
            ]
        }).run().getRange({start: 0, end: 100})

        log.debug("srAllocationProduct", srAllocationProduct);

        if(srAllocationProduct.length == 0) {
            return objInventoryItem
        }

        objResult = {
            custcol_zoku_product_allocation: srAllocationProduct[0].id,
            item: srAllocationProduct[0].getValue({name: "custrecord_zk_pa_item"}),
            left_overs:  srAllocationProduct[0].getValue({name: "custrecord_zk_pa_leftovers"}),
            allocated_quantity:  srAllocationProduct[0].getValue({name: "custrecord_zk_pa_allocated_quantity"}),
            ordered_quantity:  srAllocationProduct[0].getValue({name: "custrecord_zk_pa_ordered_quantity"}),
            advanced_item_id: srAllocationProduct[0].getValue({name: "custitem_zk_advance_item", join: "CUSTRECORD_ZK_PA_ITEM"}),
            deposit_amount: srAllocationProduct[0].getValue({name: "custitem_zk_deposit_amount", join: "CUSTRECORD_ZK_PA_ITEM"}),
            category: srAllocationProduct[0].getValue({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
            category: srAllocationProduct[0].getValue({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"})
        }
        return objResult
    }

    function appendLookupItems(arrItemsToBeSet) {
        return arrItemsToBeSet.map(function(objItem) {
            if(objItem['itemtype'] == 'InvtPart' || objItem['itemtype'] == 'Kit') {
                const recItem = search.lookupFields({
                    type: search.Type.ITEM,
                    id: objItem['item'],
                    columns: ['custitem_zk_deposit_amount', 'custitem_zk_advance_item', 'custitem_preorderitem']
                })
                objItem['deposit_amount'] = Number(recItem.custitem_zk_deposit_amount)
                objItem['advanced_item_id'] = recItem.custitem_zk_advance_item.length == 0? '': recItem.custitem_zk_advance_item[0].value
                objItem['is_preorder'] = (recItem.custitem_preorderitem.length == 0 || recItem.custitem_preorderitem[0].value != PREORDER_ITEM)? false: true
                objItem['is_allocated'] = (recItem.custitem_preorderitem.length == 0 || recItem.custitem_preorderitem[0].value != IN_STOCK)? false: true
            } else {
                objItem['is_preorder'] = false;
                objItem['is_allocated'] = false;
            }

            return objItem
        })
    }

    function checkIfPreOrderHasNoAdvancedItem(arrPreOrderItems) {
        const arrResult = arrPreOrderItems.filter(function(objItem) {
            if(!objItem.advanced_item_id) {
                return objItem
            }
        })
        if(arrResult.length == 0) return

        // const objErrorMessage = {}
        // objErrorMessage.message = 'Advanced item not found on Pre Order item'
        // objErrorMessage.items = arrResult
        // throw JSON.stringify(objErrorMessage)
        throw "No Advance Item Setup under the Item Record."
    }

    function updateProductAllocationOnClosed(getPaId, intSOId, flAllocationQuantity,intItemId) {
        var srProductAllocation = search.lookupFields({
            type: 'customrecord_zk_product_allocation',
            id: getPaId,
            columns: ['custrecord_zk_pa_allocated_quantity', 'custrecord_zk_pa_ordered_quantity', 'custrecord_zk_pa_leftovers','custrecord_zk_pa_distributor.custentity_xm_custinternaldistributor', 'custrecord_zk_pa_status']
        });

        log.debug("updateProductAllocationOnClosed srProductAllocation", srProductAllocation);

        if(srProductAllocation['custrecord_zk_pa_status'][0].value != libHelper.allocationStatus.CANCELLED) {
            var flCurrentLeftOverQty = Number(srProductAllocation['custrecord_zk_pa_leftovers']);
            var isInternalDistributor = srProductAllocation['custrecord_zk_pa_distributor.custentity_xm_custinternaldistributor'];

            var objRemainingQty = {};
            objRemainingQty['custrecord_zk_pa_ordered_quantity'] = srProductAllocation['custrecord_zk_pa_ordered_quantity'] - flAllocationQuantity
            objRemainingQty['custrecord_zk_pa_leftovers'] = flCurrentLeftOverQty + flAllocationQuantity;
            if(isInternalDistributor) {
                objRemainingQty['custrecord_zk_pa_status'] = libHelper.allocationStatus.ACKNOWLEDGE;
            } else {
                objRemainingQty['custrecord_zk_pa_status'] = libHelper.allocationStatus.PENDING;
            }
            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: getPaId,
                values: objRemainingQty
            });
        }

        updateEstimatedManufacturedQuantityCancelled(intItemId,flAllocationQuantity);

        // if(!hasRemainingSalesOrders(getPaId, intSOId)) {
        //     if(!isInternalDistributor) {
        //         record.submitFields({
        //             type: 'customrecord_zk_product_allocation',
        //             id: getPaId,
        //             values: {
        //                 custrecord_zk_pa_status: '3',
        //                 custrecord_zk_pa_ordered_quantity: 0,
        //                 custrecord_zk_pa_leftovers: 0,
        //                 custrecord_zk_pa_allocated_quantity: 0
        //             }
        //         });
        //     }
        // }
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

    function appendExistingProductAllocationDetails(arrLines) {
        return arrLines.map(function(objLine) {
            if(!objLine['custcol_zoku_product_allocation']) return objLine
            const recProductAllcoation = search.lookupFields({
                type: 'customrecord_zk_product_allocation',
                id: objLine.custcol_zoku_product_allocation,
                columns: ['custrecord_zk_pa_leftovers', 'custrecord_zk_pa_ordered_quantity']
            })
            objLine['left_overs'] = recProductAllcoation.custrecord_zk_pa_leftovers || 0
            objLine['ordered_quantity'] = recProductAllcoation.custrecord_zk_pa_ordered_quantity || 0
            return objLine
        })
    }

    return {beforeSubmit: beforeSubmit, afterSubmit: afterSubmit,beforeLoad:beforeLoad}

});