/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_ue_xm_item_allocation
Name                : Item Atllocation
Purpose             : Can add logic for product allocation
Created On          : April 26, 2022
Author              : Ceana Technology
Script Type         : User Event Script
Saved Searches      : NONE
*/

define(['N/record','../Library/zk_xm_library'], function(record, libHelper) {

    function beforeSubmit(context) {
        if(context.type == context.UserEventType.DELETE) return
        var newRecord = context.newRecord;
        if(context.type == context.UserEventType.EDIT || context.type == context.UserEventType.XEDIT) {

            const intQuantity = newRecord.getValue({fieldId: 'custitem_zk_estimated_manufacture_qty'});
            const intDistributorPool = newRecord.getValue({fieldId: 'custitem_zk_distributor_pool'}) || 0;
            const objProductAllocations = libHelper.getProductAllocations(newRecord.id, '', '');
            var intNewManufacturedQuantity = 0;
            var flTotalAllocationInternalDistributor = 0;
            var flTotalAllocated = 0;

            for (var intIndex in objProductAllocations) {
                // if (objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged") {
                    flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                // }

                // if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged" && objProductAllocations[intIndex].isInternalDistributor) {
                if(objProductAllocations[intIndex].isInternalDistributor) {
                    flTotalAllocationInternalDistributor += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                }
            }

            intNewManufacturedQuantity = parseFloat(parseFloat(intQuantity) - parseFloat(flTotalAllocated + parseFloat(intDistributorPool)));

            if(parseFloat(intNewManufacturedQuantity - flTotalAllocationInternalDistributor) < 0) {
                throw "Available Quantity should not be negative.";
            }
        }
    }

    function afterSubmit(context) {

        if(context.type == context.UserEventType.DELETE) return
        updateQuantityToSell(context);

    }

    function updateQuantityToSell(context) {
        var newRecord = context.newRecord;
        const objCurrentRecord = record.load({ type: newRecord.type, id: newRecord.id });
        var intNewManufacturedQuantity = 0;
        if(context.type == context.UserEventType.EDIT || context.type == context.UserEventType.XEDIT) {

            const intQuantity = objCurrentRecord.getValue({fieldId: 'custitem_zk_estimated_manufacture_qty'});
            const intDistributorPool = objCurrentRecord.getValue({fieldId: 'custitem_zk_distributor_pool'}) || 0;
            const objProductAllocations = libHelper.getProductAllocations(newRecord.id, '', '');
            var flTotalAllocationInternalDistributor = 0;
            var flTotalAllocated = 0;

            log.debug("objProductAllocations", objProductAllocations);

            for (var intIndex in objProductAllocations) {

                if(objProductAllocations[intIndex].isInternalDistributor) {
                    // if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged") {
                        flTotalAllocationInternalDistributor += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                    // }
                } else {
                    // if (objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending" || objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged") {
                        flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_allocated_quantity || 0);
                    // }
                }

            }

            intNewManufacturedQuantity = parseFloat(parseFloat(intQuantity) - parseFloat(flTotalAllocated));

            log.debug('logs', {
                intQuantity: intQuantity,
                flTotalAllocated: flTotalAllocated,
                intNewManufacturedQuantity: intNewManufacturedQuantity,
                flTotalAllocationInternalDistributor: flTotalAllocationInternalDistributor,
                lessTotalAllocationInternDistributor: parseFloat(intNewManufacturedQuantity - flTotalAllocationInternalDistributor)
            });
            objCurrentRecord.setValue({fieldId: 'custitem_zk_available_manufacture_qty', value: parseFloat(intNewManufacturedQuantity - flTotalAllocationInternalDistributor)});
        } else {
            objCurrentRecord.setValue({fieldId: 'custitem_zk_available_manufacture_qty', value: objCurrentRecord.getValue({fieldId: 'custitem_zk_estimated_manufacture_qty'})});
        }

        // if(parseFloat(intNewManufacturedQuantity - flTotalAllocationInternalDistributor) < 0) {
        //     throw "Available Quantity should not be negative.";
        // } else {
            objCurrentRecord.save();
        // }

    }

    return { afterSubmit: afterSubmit, beforeSubmit: beforeSubmit }
})