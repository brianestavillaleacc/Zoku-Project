/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_cs_xm_disc_calculation
Name                : ZK CS XM Discount Calculation
Purpose             : Sales Order Discount Calculation
Created On          : October 5,2021
Author              : Ceana Technology
Script Type         : Client Script
Saved Searches      : NONE
*/

define(['N/search','N/record'], function(search, record) {
    var flOldQuantity = "";
    function pageInit(context) {
        var currentRecord = context.currentRecord;
        for(var intIndex=0; intIndex<currentRecord.getLineCount('item'); intIndex++) {
            var intProductAllocationId = currentRecord.getSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation", line: intIndex});
            if(intProductAllocationId) {
                flOldQuantity = currentRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: intIndex});
            }
        }
    }

    // function lineInit(context) {
    //     var currentRecord = context.currentRecord;
    //     var intProductAllocationId = currentRecord.getValue("custbody_zk_so_product_allocation");
    //     if(intProductAllocationId) {
    //         if(currentRecord.getCurrentSublistValue({sublistId:"item", fieldId:"line"}) != '2') {
    //             var sublistObj = currentRecord.getSublist({ sublistId: 'item' });
    //             sublistObj.getColumn({ fieldId: 'rate' }).isDisabled = true;
    //             sublistObj.getColumn({ fieldId: 'quantity' }).isDisabled = true;
    //             sublistObj.getColumn({ fieldId: 'amount' }).isDisabled = true;
    //         } else {
    //             var sublistObj = currentRecord.getSublist({ sublistId: 'item' });
    //             sublistObj.getColumn({ fieldId: 'rate' }).isDisabled = false;
    //             sublistObj.getColumn({ fieldId: 'quantity' }).isDisabled = false;
    //             sublistObj.getColumn({ fieldId: 'amount' }).isDisabled = false;
    //         }
    //     }
    //
    // }

    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        if(context.sublistId == "item" && context.fieldId == "item") {
            var stItem = currentRecord.getCurrentSublistText({sublistId:"item", fieldId:"item"})
            if(stItem.toUpperCase().indexOf("ADVANCE DEPOSIT") != -1) return;

            var fieldCustomerLookUp = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: currentRecord.getValue('entity'),
                columns: ['category']
            });

            var fieldItemLookUp = search.lookupFields({
                type: search.Type.ITEM,
                id: currentRecord.getCurrentSublistValue({sublistId:"item", fieldId:"item"}),
                columns: ['pricinggroup']
            });

            var intCustomerCategory  =  (fieldCustomerLookUp.category.length != 0) ? fieldCustomerLookUp.category[0].value : "";
            var intPricingGroup  =  (fieldItemLookUp.pricinggroup.length != 0) ? fieldItemLookUp.pricinggroup[0].value : "";

            var discountPercent = parseFloat(getCustomerDiscountPercent(intCustomerCategory,intPricingGroup));
            currentRecord.setCurrentSublistValue({sublistId:"item", fieldId:"custcol_discount_percent",value: discountPercent, ignoreFieldChange: false });
        }

        if(context.sublistId == "item" && context.fieldId == "custcol_discount_percent" ||  context.fieldId == "custcol_original_rate" ||  context.fieldId == "quantity") {
            if(context.fieldId == "quantity") {

                if(!currentRecord.getCurrentSublistValue({sublistId:"item", fieldId:"custcol_zoku_product_allocation"})) return;

                var intProductAllocationId = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId: "custcol_zoku_product_allocation"});
                var intItemId = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId: "item"});
                var objProductAllocations = getProductAllocations(intItemId);

                if(intProductAllocationId) {
                    var flNewQuantity = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId: "quantity"});
                    if(!objProductAllocations[intProductAllocationId].isInternalDistributor && flNewQuantity < flOldQuantity) {
                        alert("Cannot update the quantity lesser than the acknowledged quantity.");
                        currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"quantity", value:flOldQuantity});
                    } else if(flOldQuantity != flNewQuantity) {
                        var flTotalPendingProductAllocation = 0;
                        var flAdditionalQty = flNewQuantity - flOldQuantity;
                        var lookupFieldItem = search.lookupFields({
                            type: search.Type.ITEM,
                            id: intItemId,
                            columns: ['custitem_zk_available_manufacture_qty','type','isserialitem','islotitem','custitem_zk_distributor_pool']
                        });

                        var flTotalAvailableQuantity = lookupFieldItem['custitem_zk_available_manufacture_qty'] || 0;
                        var intDistributorPool = lookupFieldItem['custitem_zk_distributor_pool'] || 0;
                        var intRemainder = calculateRemainder(flTotalAvailableQuantity, objProductAllocations, intDistributorPool);

                        // for(var intIndex in objProductAllocations) {
                        //     if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending") {
                        //         flTotalPendingProductAllocation += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                        //     }
                        // }

                        // if(parseFloat(flTotalAvailableQuantiity - flTotalPendingProductAllocation) < flAdditionalQty) {
                        if(parseFloat(intRemainder - flAdditionalQty) < 0) {
                            alert("Not Enough Available Quantity.");
                            currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"quantity", value:flOldQuantity});
                        }
                    }
                }
            }
            calculateDiscount(currentRecord);
        }

        if(context.sublistId == "item" && context.fieldId == "price" || context.fieldId == "rate") {
            var flRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"rate"});
            currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"custcol_original_rate",value:flRate});
        }

        if(context.sublistId == "item" && context.fieldId == "rate") {
            if(currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"line"}) == 1) {
                var flRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"rate"});
                var flAmount = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"amount"});
                var flOriginalRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"custcol_original_rate"});
                var currentLine = currentRecord.selectLine({ sublistId: 'item', line: 2 });
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "rate", value: flRate * -1, ignoreFieldChange: true});
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "amount", value: flAmount * -1,ignoreFieldChange: true});
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "custcol_original_rate", value: flOriginalRate * -1,ignoreFieldChange: true});
                currentLine.commitLine({ sublistId: 'item' });
            }
        }
    }

    // function validateLine(context) {
    //     var currentRecord = context.currentRecord;
    //     if(currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"line"}) == "1") {
    //         if(context.sublistId == "item") {
    //             var flRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"rate"});
    //             var flAmount = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"amount"});
    //             var flOriginalRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"custcol_original_rate"});
    //             var currentLine = currentRecord.selectLine({ sublistId: 'item', line: 2 });
    //             currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "rate", value: flRate * -1, ignoreFieldChange: true});
    //             currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "amount", value: flAmount * -1,ignoreFieldChange: true});
    //             currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "custcol_original_rate", value: flOriginalRate * -1,ignoreFieldChange: true});
    //             currentLine.commitLine({ sublistId: 'item' });
    //         }
    //     }
    // }

    function saveRecord(context) {
        var currentRecord = context.currentRecord;
        var intProductAllocationId = currentRecord.getValue("custbody_zk_so_product_allocation");

        if(intProductAllocationId) {
            var flNewQuantity = currentRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 1});
            var flNewRate = currentRecord.getSublistValue({sublistId: "item", fieldId: "rate", line: 1});
            var flNewOriginalRate = currentRecord.getSublistValue({sublistId: "item", fieldId: "custcol_original_rate", line: 1});
            if(flOldQuantity != flNewQuantity) {
                var lookupFieldItem = search.lookupFields({
                    type: search.Type.ITEM,
                    id: currentRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 1}),
                    columns: ['custitem_zk_deposit_amount']
                });
                var flDepositAmount = (lookupFieldItem.custitem_zk_deposit_amount) ? lookupFieldItem.custitem_zk_deposit_amount : 0;
                var flAdvanceDepositRate = (flNewRate < flDepositAmount) ? flNewRate : flDepositAmount;
                var flNewAmount = flAdvanceDepositRate * flNewQuantity;

                var currentLine = currentRecord.selectLine({ sublistId: 'item', line: 0 });
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "quantity", value: flNewQuantity});
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "rate", value: flAdvanceDepositRate});
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "amount", value: flNewAmount});
                currentLine.setCurrentSublistValue({sublistId: "item", fieldId: "custcol_original_rate", value: flAdvanceDepositRate});
                currentLine.commitLine({ sublistId: 'item' });

                var currentLine = currentRecord.selectLine({ sublistId: 'item', line: 2 });
                currentRecord.setCurrentSublistValue({sublistId: "item", fieldId: "quantity", value: flNewQuantity});
                currentRecord.setCurrentSublistValue({sublistId: "item", fieldId: "rate", value: flAdvanceDepositRate * -1});
                currentRecord.setCurrentSublistValue({sublistId: "item", fieldId: "amount", value: flNewAmount * -1});
                currentRecord.setCurrentSublistValue({sublistId: "item", fieldId: "custcol_original_rate", value: flAdvanceDepositRate * -1});
                currentLine.commitLine({ sublistId: 'item' });

                record.submitFields({
                    type: 'customrecord_zk_product_allocation',
                    id: intProductAllocationId,
                    values: { 'custrecord_zk_pa_allocated_quantity': flNewQuantity }
                });
                updateEstimatedManufacturedQuantity(context);
            }
        }

        return true;
    }

    function calculateRemainder(intAvailableManufactureQuantity, objProductAllocations, intDistributorPool) {
        var flTotalAllocated = 0;
        var flTotalDeductions = 0;
        for (var intIndex in objProductAllocations) {
            if (objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending") {
                flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_leftovers || 0);
            }
            if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged" && objProductAllocations[intIndex].isInternalDistributor) {
                flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_leftovers || 0);
            }
        }

        flTotalDeductions = parseFloat(flTotalAllocated + parseFloat(intDistributorPool));
        return parseFloat(intAvailableManufactureQuantity - flTotalDeductions);
    }

    function updateEstimatedManufacturedQuantity(context) {
        var currentRecord = context.currentRecord;
        var flOldAllocationQuantity = flOldQuantity;
        var intItemId = currentRecord.getSublistValue({sublistId: "item", fieldId: "item", line: 0});
        var flNewAllocationQuantity = currentRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: 0});
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
            columns: ['custitem_zk_available_manufacture_qty','type','isserialitem','islotitem']
        });
        var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
        if(lookupFieldItem.isserialitem) { stItemType = "serializedinventoryitem"; }
        if(lookupFieldItem.islotitem) { stItemType = "lotnumberedinventoryitem"; }

        var flRemaningQuantity = 0;
        var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;

        if(flNewAllocationQuantity>flOldAllocationQuantity) {
            var flExcessQuantity = parseFloat(flNewAllocationQuantity) - parseFloat(flOldAllocationQuantity);
            flRemaningQuantity = parseFloat(flEstimatedQuantity) - flExcessQuantity;
        } else {
            var flToBeReturnedQuantity = parseFloat(flOldAllocationQuantity) - parseFloat(flNewAllocationQuantity);
            flRemaningQuantity = parseFloat(flEstimatedQuantity) + flToBeReturnedQuantity;
        }

        record.submitFields({
            type: stItemType,
            id: intItemId,
            values: { custitem_zk_available_manufacture_qty: flRemaningQuantity }
        });
    }

    function calculateDiscount(currentRecord) {
        var flQuantity = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"quantity"});
        var flOriginalRate = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"custcol_original_rate"});
        var flDiscount = currentRecord.getCurrentSublistValue({sublistId: "item", fieldId:"custcol_discount_percent"}) || 0;
        var flDiscountAmount = flOriginalRate * parseFloat(flDiscount/100);
        var flTotalDiscountAmount = flDiscountAmount*flQuantity;
        var flDiscountedRate = flOriginalRate - flDiscountAmount;
        currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"custcol_discount_amount",value:flTotalDiscountAmount});
        currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"rate",value: flDiscountedRate, ignoreFieldChange: true});
        currentRecord.setCurrentSublistValue({sublistId: "item", fieldId:"amount",value: flQuantity*flDiscountedRate });
    }

    function getProductAllocations(intItemId) {
        var objData = {};
        var filters = [
            ["custrecord_zk_pa_item","is",intItemId], "AND",
            // ["custrecord_zk_pa_location","is",intLocationId], "AND",
            ["custrecord_zk_pa_status","noneof",3]
        ];

        var itemSearchObj = search.create({
            type: "customrecord_zk_product_allocation",
            filters: filters,
            columns: [
                search.createColumn({ name: "custrecord_zk_pa_distributor" }),
                search.createColumn({ name: "custrecord_zk_pa_allocated_quantity" }),
                search.createColumn({ name: "custrecord_zk_pa_ordered_quantity" }),
                search.createColumn({ name: "custrecord_zk_pa_leftovers" }),
                search.createColumn({ name: "custrecord_zk_pa_waitlist" }),
                search.createColumn({ name: "custrecord_zk_pa_change" }),
                search.createColumn({ name: "custrecord_zk_pa_status" }),
                search.createColumn({ name: "custrecord_zk_pa_deposit" }),
                search.createColumn({ name: "custrecord_zk_pa_balance" }),
                search.createColumn({ name: "custrecord_zk_pa_notes" }),
                search.createColumn({ name: "custrecord_zk_pa_item" }),
                search.createColumn({ name: "lastmodified" }),
                search.createColumn({ name: "custrecord_zk_pa_location" }),
                search.createColumn({
                    name: "custentity_xm_custinternaldistributor",
                    join: "custrecord_zk_pa_distributor"
                })
            ]
        });
        var searchResultCount = itemSearchObj.runPaged().count;
        if(searchResultCount != 0) {
            itemSearchObj.run().each(function(result){
                if(objData[result.id] == null) { objData[result.id] = {}; }
                objData[result.id] = {
                    'recordid': result.id,
                    'lastmodified': result.getValue('lastmodified'),
                    'custrecord_zk_pa_distributor': result.getText('custrecord_zk_pa_distributor'),
                    'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                    'custrecord_zk_pa_ordered_quantity':  result.getValue('custrecord_zk_pa_ordered_quantity') || 0,
                    'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers') || 0,
                    'custrecord_zk_pa_waitlist': result.getValue('custrecord_zk_pa_waitlist') || 0,
                    'custrecord_zk_pa_change': result.getValue('custrecord_zk_pa_change') || 0,
                    'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                    'isPending': (result.getText('custrecord_zk_pa_status') == 'Pending') ? true : false,
                    'isCancelled': (result.getText('custrecord_zk_pa_status') == 'Cancelled') ? true : false,
                    'custrecord_zk_pa_deposit': result.getValue('custrecord_zk_pa_deposit'),
                    'custrecord_zk_pa_balance': result.getValue('custrecord_zk_pa_balance'),
                    'custrecord_zk_pa_notes': result.getValue('custrecord_zk_pa_notes'),
                    'custrecord_zk_pa_item': result.getText('custrecord_zk_pa_item'),
                    'custrecord_zk_pa_location': result.getText('custrecord_zk_pa_location'),
                    'custrecord_zk_pa_locationid': result.getValue('custrecord_zk_pa_location'),
                    'isInternalDistributor': result.getValue({
                        name: "custentity_xm_custinternaldistributor",
                        join: "custrecord_zk_pa_distributor"
                    })
                };
                return true;
            });
        }
        return objData;
    }

    function getCustomerDiscountPercent(intCustomerCategory, intPricingGroup) {
        var discountPercent = 0;
        if(!intCustomerCategory || !intPricingGroup) { return discountPercent; }
        var discountSearchObj = search.create({
            type: "customrecord_customer_discounting",
            filters: [
                ["isinactive","is","F"],"AND",
                ["custrecord_zk_cd_customer_category","anyof",[intCustomerCategory]],"AND",
                ["custrecord_zk_cd_pricing_grioup","anyof",[intPricingGroup]]
            ],
            columns: [ search.createColumn({name: "custrecord_zk_cd_discount_percent"}) ]
        });
        var searchResultCount = discountSearchObj.runPaged().count;
        if(searchResultCount != 0) {
            discountSearchObj.run().each(function(result){
                discountPercent = result.getValue({name: "custrecord_zk_cd_discount_percent"});
                console.log("discountPercent:: "+discountPercent);
                return true;
            });
        }
        return discountPercent;
    }

    // return { fieldChanged: fieldChanged, saveRecord: saveRecord, pageInit: pageInit };
    return { fieldChanged: fieldChanged, pageInit: pageInit };
});